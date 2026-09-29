/**
 * Alarms API（HEALTH-INCIDENT-ENTRY-01 HI-01B）：GET 列表/单条 + POST ack。
 *
 * - Alarm 是投影层派生事实（HI-01A drain 点折叠）——本面只读 + ACK。
 * - **ACK = operator awareness only**（HI 红线）：仅写 ack_at/ack_by/ack_note
 *   三字段；绝不改变 active/恢复状态，绝不解释为 Runtime healthy。审计
 *   action = `alarm.ack`（who/when/what，无 secret；best-effort 不阻塞响应）。
 * - 列表 keyset 分页（first_seen_at desc, id desc；before_id 游标）+
 *   active/severity 过滤——增长集合分页契约（EXTERNAL_API_CONTRACT §4）。
 */
import type { FastifyInstance } from "fastify";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { alarms } from "../db/schema.ts";
import type { Db } from "../db/index.ts";
import { ApiError, internalError, notFound, validationError } from "../lib/errors.ts";
import {
  ROUTE_PERMISSIONS,
  type RequestPrincipal,
} from "../security/fastifySecurity.ts";
import { SecurityAudit } from "../security/audit.ts";
import { assertCanonicalUuid, ClientSessionIdError } from "../lib/sessionIds.ts";
import { ROUTE_SCHEMAS } from "./schemas.ts";

export interface AlarmRouteDeps {
  db: Db | null;
  audit: SecurityAudit | null;
}

function requirePrincipal(req: { principal: RequestPrincipal | null }): RequestPrincipal {
  if (req.principal === null) {
    throw internalError("authenticated principal is missing on a secured route");
  }
  return req.principal;
}

function requireDb(deps: AlarmRouteDeps): Db {
  if (deps.db === null) {
    throw new ApiError(
      "RESOURCE_UNAVAILABLE",
      503,
      "alarm persistence is not configured on this control plane",
      false,
    );
  }
  return deps.db;
}

function canonicalAlarmId(raw: string): string {
  try {
    return assertCanonicalUuid(raw);
  } catch (err) {
    if (err instanceof ClientSessionIdError) {
      throw validationError("alarm id path parameter must be a canonical UUID");
    }
    throw err;
  }
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function toWire(row: typeof alarms.$inferSelect): Record<string, unknown> {
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    severity: row.severity,
    kind: row.kind,
    failure_domain: row.failureDomain,
    related_session_id: row.relatedSessionId,
    related_device_id: row.relatedDeviceId,
    related_pipeline_id: row.relatedPipelineId,
    summary: row.summary,
    retryable: row.retryable,
    recovery_status: row.recoveryStatus,
    first_seen_at: iso(row.firstSeenAt),
    last_seen_at: iso(row.lastSeenAt),
    event_count: row.eventCount,
    active: row.active,
    cleared_at: iso(row.clearedAt),
    clear_reason: row.clearReason,
    ack_at: iso(row.ackAt),
    ack_by: row.ackBy,
    ack_note: row.ackNote,
  };
}

export async function alarmRoutes(app: FastifyInstance, deps: AlarmRouteDeps): Promise<void> {
  const schemaFor = (method: string, url: string) =>
    ROUTE_SCHEMAS.find((s) => s.method === method && s.url === url)?.schema;

  app.get(
    "/api/v1/alarms",
    {
      config: { security: { permission: ROUTE_PERMISSIONS.alarmRead, bucket: "read" } },
      ...(schemaFor("GET", "/api/v1/alarms") !== undefined
        ? { schema: schemaFor("GET", "/api/v1/alarms")! }
        : {}),
    },
    async (req, _reply) => {
      const db = requireDb(deps);
      requirePrincipal(req);
      const q = (req.query ?? {}) as Record<string, string>;
      let limit = 50;
      if (q.limit !== undefined) {
        limit = Number.parseInt(q.limit, 10);
        if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
          throw validationError("limit must be an integer in 1..200");
        }
      }
      const conditions = [];
      if (q.active === "true") conditions.push(eq(alarms.active, true));
      if (q.active === "false") conditions.push(eq(alarms.active, false));
      if (q.severity === "warning" || q.severity === "error") {
        conditions.push(eq(alarms.severity, q.severity));
      }
      if (q.before_id !== undefined) {
        // keyset（first_seen_at desc, id desc）：游标行先取时间戳。
        const before = canonicalAlarmId(q.before_id);
        const cursorRows = await db
          .select({ firstSeenAt: alarms.firstSeenAt, id: alarms.id })
          .from(alarms)
          .where(eq(alarms.id, before))
          .limit(1);
        if (cursorRows.length === 0) throw notFound(`alarm ${before} not found (before_id cursor)`);
        const cursor = cursorRows[0]!;
        conditions.push(
          or(
            lt(alarms.firstSeenAt, cursor.firstSeenAt),
            and(eq(alarms.firstSeenAt, cursor.firstSeenAt), lt(alarms.id, cursor.id)),
          ),
        );
      }
      const rows = await db
        .select()
        .from(alarms)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(alarms.firstSeenAt), desc(alarms.id))
        .limit(limit);
      return { alarms: rows.map(toWire), count: rows.length };
    },
  );

  app.get(
    "/api/v1/alarms/:id",
    {
      config: { security: { permission: ROUTE_PERMISSIONS.alarmRead, bucket: "read" } },
      ...(schemaFor("GET", "/api/v1/alarms/:id") !== undefined
        ? { schema: schemaFor("GET", "/api/v1/alarms/:id")! }
        : {}),
    },
    async (req, _reply) => {
      const db = requireDb(deps);
      requirePrincipal(req);
      const raw = (req.params as Record<string, unknown>).id;
      if (typeof raw !== "string") throw validationError("alarm id must be a canonical UUID");
      const id = canonicalAlarmId(raw);
      const rows = await db.select().from(alarms).where(eq(alarms.id, id)).limit(1);
      if (rows.length === 0) throw notFound(`alarm ${id} not found`);
      return toWire(rows[0]!);
    },
  );

  app.post(
    "/api/v1/alarms/:id/ack",
    {
      config: { security: { permission: ROUTE_PERMISSIONS.alarmAck, bucket: "write" } },
      ...(schemaFor("POST", "/api/v1/alarms/:id/ack") !== undefined
        ? { schema: schemaFor("POST", "/api/v1/alarms/:id/ack")! }
        : {}),
    },
    async (req, reply) => {
      const db = requireDb(deps);
      const principal = requirePrincipal(req);
      const raw = (req.params as Record<string, unknown>).id;
      if (typeof raw !== "string") throw validationError("alarm id must be a canonical UUID");
      const id = canonicalAlarmId(raw);
      const body = (req.body ?? {}) as Record<string, unknown>;
      let note: string | null = null;
      if (body.note !== undefined) {
        if (typeof body.note !== "string" || body.note.length === 0 || body.note.length > 1024) {
          throw validationError("note must be a string of 1..1024 characters");
        }
        note = body.note;
      }
      // 条件 UPDATE：只写 ack_* 三字段（awareness only）；幂等（重复 ack 刷新时间戳）。
      const updated = await db
        .update(alarms)
        .set({ ackAt: new Date(), ackBy: principal.userId, ackNote: note })
        .where(eq(alarms.id, id))
        .returning();
      if (updated.length === 0) throw notFound(`alarm ${id} not found`);
      if (deps.audit !== null) {
        await deps.audit.recordBestEffort(
          {
            principal: principal.userId,
            role: principal.role,
            action: "alarm.ack",
            decision: "allowed",
            detail: { alarmId: id, note: note !== null, active: updated[0]!.active },
          },
          { warn: () => {} },
        );
      }
      return reply.code(200).send(toWire(updated[0]!));
    },
  );
}
