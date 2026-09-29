/**
 * Command API（CP-01B/CP-01C）：POST 资源动作 + GET /commands/{id}（Operation 面）。
 *
 * - Idempotency-Key header 优先于 body command_id（C6）；均缺省由服务端生成。
 * - 客户端 URL session id 只接受 canonical UUID（C9/F13 客户端方向 → 4xx）。
 * - 两平面纪律：响应是命令裁决/Operation 旅程，不是 Runtime 现状（C8）。
 * - CP-01C：principal = 认证主体（Better Auth user id，经 security 链注入；
 *   x-dev-principal 开发态桩已删除）；`requested_by` 恒取认证主体 id，不再
 *   接受客户端自报（硬化）；每条路由声明 CASL permission + 限流 bucket——
 *   authn/authz/rate-limit 拒绝不进 handler ⇒ 不占幂等、零 dispatch（C4）。
 */
import type { FastifyInstance, FastifySchema } from "fastify";
import { ApiError, internalError, notFound, validationError } from "../lib/errors.ts";
import { assertCanonicalUuid, ClientSessionIdError } from "../lib/sessionIds.ts";
import { canonicalCommandId } from "../command/commandIds.ts";
import { CommandService, type CommandKind, type CommandPlane } from "../command/commandService.ts";
import { ROUTE_PERMISSIONS, type PermissionSpec, type RequestPrincipal } from "../security/fastifySecurity.ts";
import { ROUTE_SCHEMAS } from "./schemas.ts";

export interface CommandRouteDeps {
  commandService: CommandPlane | null;
}

/** 命令 kind → 审计 action 语义（audit_entries.action）。 */
export const COMMAND_ACTION: Record<CommandKind, string> = {
  start_session: "session.start",
  stop_session: "session.stop",
  release_session: "session.release",
};

/** 命令 kind → CASL permission（ROUTE_PERMISSIONS 键与 CommandKind 解耦）。 */
const KIND_PERMISSION: Record<CommandKind, PermissionSpec> = {
  start_session: ROUTE_PERMISSIONS.sessionStart,
  stop_session: ROUTE_PERMISSIONS.sessionStop,
  release_session: ROUTE_PERMISSIONS.sessionRelease,
};

function requirePrincipal(req: { principal: RequestPrincipal | null }): RequestPrincipal {
  // security 链（authn→authz→ratelimit）保证已认证；null = 组合根接线缺陷。
  if (req.principal === null) {
    throw internalError("authenticated principal is missing on a secured route");
  }
  return req.principal;
}

function canonicalSessionParam(raw: string): string {
  try {
    return assertCanonicalUuid(raw);
  } catch (err) {
    if (err instanceof ClientSessionIdError) {
      throw validationError("session id path parameter must be a canonical UUID");
    }
    throw err;
  }
}

function commandKeyFrom(
  headers: Record<string, unknown>,
  body: Record<string, unknown>,
): string | undefined {
  const header = headers["idempotency-key"];
  if (header !== undefined) {
    if (typeof header !== "string" || header.length === 0 || header.length > 256) {
      throw validationError("Idempotency-Key must be a string of 1..256 characters");
    }
    return header;
  }
  const bodyId = body.command_id;
  if (bodyId === undefined) return undefined;
  if (typeof bodyId !== "string" || bodyId.length === 0 || bodyId.length > 256) {
    throw validationError("command_id must be a string of 1..256 characters");
  }
  return bodyId;
}

function requireCommandPlane(deps: CommandRouteDeps): CommandPlane {
  if (deps.commandService === null) {
    // 控制面以读 API 形态部署（未配置持久层）——诚实 503，不是客户端错误。
    throw new ApiError(
      "RESOURCE_UNAVAILABLE",
      503,
      "command persistence is not configured on this control plane",
      false,
    );
  }
  return deps.commandService;
}

export async function commandRoutes(app: FastifyInstance, deps: CommandRouteDeps): Promise<void> {
  const startSchema = ROUTE_SCHEMAS.find(
    (s) => s.method === "POST" && s.url === "/api/v1/sessions",
  )?.schema;
  const stopSchema = ROUTE_SCHEMAS.find(
    (s) => s.method === "POST" && s.url === "/api/v1/sessions/:id/stop",
  )?.schema;
  const releaseSchema = ROUTE_SCHEMAS.find(
    (s) => s.method === "POST" && s.url === "/api/v1/sessions/:id/release",
  )?.schema;
  const commandGetSchema = ROUTE_SCHEMAS.find(
    (s) => s.method === "GET" && s.url === "/api/v1/commands/:id",
  )?.schema;

  app.post(
    "/api/v1/sessions",
    {
      config: { security: { permission: ROUTE_PERMISSIONS.sessionStart, bucket: "write" } },
      ...(startSchema !== undefined ? { schema: startSchema } : {}),
    },
    async (req, reply) => {
      const service = requireCommandPlane(deps);
      const principal = requirePrincipal(req);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const intent: unknown = body.intent;
      if (typeof intent !== "object" || intent === null || Array.isArray(intent)) {
        throw validationError("intent must be an object with version and a non-empty devices array");
      }
      const intentRecord = intent as Record<string, unknown>;
      if (
        typeof intentRecord.version !== "string" ||
        !Array.isArray(intentRecord.devices) ||
        intentRecord.devices.length === 0
      ) {
        throw validationError("intent must be an object with version and a non-empty devices array");
      }
      const res = await service.submit({
        rawCommandId: commandKeyFrom(req.headers, body),
        principal: principal.userId,
        role: principal.role,
        action: COMMAND_ACTION.start_session,
        kind: "start_session",
        target: { target_type: "session", intent },
        requestedBy: principal.userId,
      });
      return reply.code(res.status).send(res.body);
    },
  );

  const sessionAction = (kind: CommandKind, path: string, schema: FastifySchema | undefined) => {
    app.post(
      path,
      {
        config: { security: { permission: KIND_PERMISSION[kind], bucket: "write" } },
        ...(schema !== undefined ? { schema } : {}),
      },
      async (req, reply) => {
        const service = requireCommandPlane(deps);
        const principal = requirePrincipal(req);
        const body = (req.body ?? {}) as Record<string, unknown>;
        const rawId = (req.params as Record<string, unknown>).id;
        if (typeof rawId !== "string") throw validationError("session id must be a canonical UUID");
        const sessionId = canonicalSessionParam(rawId);
        const res = await service.submit({
          rawCommandId: commandKeyFrom(req.headers, body),
          principal: principal.userId,
          role: principal.role,
          action: COMMAND_ACTION[kind],
          kind,
          target: { target_type: "session_by_id", session_id: sessionId },
          requestedBy: principal.userId,
        });
        return reply.code(res.status).send(res.body);
      },
    );
  };
  // ROUTE_PERMISSIONS 键与 CommandKind 同名（start/stop/release session）。
  sessionAction("stop_session", "/api/v1/sessions/:id/stop", stopSchema);
  sessionAction("release_session", "/api/v1/sessions/:id/release", releaseSchema);

  app.get(
    "/api/v1/commands/:id",
    {
      config: { security: { permission: ROUTE_PERMISSIONS.commandRead, bucket: "read" } },
      ...(commandGetSchema !== undefined ? { schema: commandGetSchema } : {}),
    },
    async (req, reply) => {
      const service = requireCommandPlane(deps);
      requirePrincipal(req);
      const rawId = (req.params as Record<string, unknown>).id;
      if (typeof rawId !== "string") throw validationError("command id must be canonical");
      const commandId = canonicalCommandId(rawId);
      const res = await service.getOperation(commandId);
      if (res === undefined) {
        throw notFound(`command ${commandId} not found`);
      }
      return reply.code(res.status).send(res.body);
    },
  );
}
