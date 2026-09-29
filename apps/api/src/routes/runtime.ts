/**
 * Product 读 API v0（CP-01A frozen scope）：`GET /api/v1/runtime` live 投影。
 * mutable Runtime 状态零本地缓存——每次请求 live 查询 agent（C2/F8）。
 */
import type { FastifyInstance } from "fastify";
import {
  AgentTransportFailure,
  type AgentControlClient,
} from "../agent/agentControlClient.ts";
import { toProductRuntime } from "../agent/normalize.ts";
import { ROUTE_PERMISSIONS } from "../security/fastifySecurity.ts";
import {
  dependencyUnavailable,
  internalError,
  notFound,
  validationError,
  type ApiError,
} from "../lib/errors.ts";
import { assertCanonicalUuid, ClientSessionIdError } from "../lib/sessionIds.ts";
import type { AgentQuerySnapshotWire } from "../agent/types.ts";
import type { ProductRuntimeSnapshot } from "../agent/normalize.ts";
import { ROUTE_SCHEMAS } from "./schemas.ts";

export function mapAgentFailure(f: AgentTransportFailure): ApiError {
  switch (f.causeKind) {
    case "network":
      return dependencyUnavailable("media-agent runtime control is unreachable");
    case "http-status":
      return dependencyUnavailable(
        "media-agent runtime control returned an unsuccessful response",
      );
    default:
      // malformed-body / rpc-error / invalid-result = 内部契约违例（F1 家族 5xx）。
      return internalError("media-agent runtime control returned an invalid response");
  }
}

export interface RouteDeps {
  agent: AgentControlClient;
}

export async function runtimeRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  const runtimeSchema = ROUTE_SCHEMAS.find(
    (s) => s.method === "GET" && s.url === "/api/v1/runtime",
  )?.schema;
  app.get(
    "/api/v1/runtime",
    {
      // CP-01C：runtime read = CASL (read, runtime) + principal×read 限流。
      config: { security: { permission: ROUTE_PERMISSIONS.runtimeRead, bucket: "read" } },
      ...(runtimeSchema !== undefined ? { schema: runtimeSchema } : {}),
    },
    async (req, reply) => {
    const raw = (req.query as Record<string, unknown>).session_id;
    let filter: string | undefined;
    if (raw !== undefined) {
      if (typeof raw !== "string") {
        throw validationError("session_id must be a single canonical UUID");
      }
      try {
        filter = assertCanonicalUuid(raw);
      } catch (err) {
        if (err instanceof ClientSessionIdError) {
          throw validationError("session_id must be a canonical UUID");
        }
        throw err;
      }
    }

    let wire: AgentQuerySnapshotWire;
    try {
      wire = await deps.agent.runtimeQuery();
    } catch (err) {
      if (err instanceof AgentTransportFailure) {
        req.log.error({ agentFailure: err.causeKind, detail: err.detail }, "runtime.query failed");
        throw mapAgentFailure(err);
      }
      throw err;
    }

    let snapshot: ProductRuntimeSnapshot;
    try {
      snapshot = toProductRuntime(wire);
    } catch (err) {
      // F13（2026-09-23 修正）：agent 返回非法 session-id wire = 内部契约违例
      // → 5xx INTERNAL_ERROR；绝不 4xx、不猜测、不当成"没有 session"。
      req.log.error({ err }, "agent snapshot session-id normalization failed");
      throw internalError("runtime snapshot could not be normalized");
    }

    if (filter !== undefined) {
      snapshot.sessions = snapshot.sessions.filter((s) => s.id === filter);
      if (snapshot.sessions.length === 0) {
        throw notFound(`session ${filter} not found in current runtime state`);
      }
    }
    return reply.send(snapshot);
    },
  );
}
