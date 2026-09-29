/**
 * Health 面（EXTERNAL_API_CONTRACT §7：liveness/readiness/dependency 区分；
 * 分层不合并单 status）。
 *
 * - `GET /health/live`：liveness——只证明进程服务能力，不探测依赖
 *   （compose healthcheck 契约；agent 重启不得引发 fastify 容器 flap）。
 * - `GET /healthz`：分层依赖健康快照——api 层恒 up（端点自身可应答即真），
 *   runtime 层 live 观测 `agent.health`，db 层（CP-01B 持久记录载体，
 *   非 Runtime truth）SELECT 1 探测或诚实 not_configured，auth 层（CP-01C
 *   Better Auth；依赖 db + secret）如实区分 up / not_configured。
 *
 * 本面是显式登记的无认证运维探针例外（基础设施 liveness/readiness）；
 * Product `/api/v1/*` 全部走 security 链。
 */
import type { FastifyInstance } from "fastify";
import { AgentTransportFailure, type AgentControlClient } from "../agent/agentControlClient.ts";
import type { RouteDeps } from "./runtime.ts";
import type { Db } from "../db/index.ts";
import type { Authenticator } from "../security/auth.ts";
import type { ProjectionDrainLoop } from "../events/eventPlane.ts";
import { ROUTE_SCHEMAS } from "./schemas.ts";

export interface HealthRouteDeps {
  agent: AgentControlClient;
  db?: Db | null;
  /** CP-01C：auth 层实例（null = not_configured）。 */
  authenticator?: Authenticator | null;
  /** CP-01D：事件面 drain loop（null = not_configured）。 */
  drainLoop?: ProjectionDrainLoop | null;
}

export async function healthRoutes(app: FastifyInstance, deps: HealthRouteDeps): Promise<void> {
  const liveSchema = ROUTE_SCHEMAS.find(
    (s) => s.method === "GET" && s.url === "/health/live",
  )?.schema;
  const healthzSchema = ROUTE_SCHEMAS.find(
    (s) => s.method === "GET" && s.url === "/healthz",
  )?.schema;

  app.get(
    "/health/live",
    liveSchema !== undefined ? { schema: liveSchema } : {},
    async () => ({ status: "live" }),
  );

  app.get(
    "/healthz",
    healthzSchema !== undefined ? { schema: healthzSchema } : {},
    async (req) => {
    const checkedAtMs = Date.now();
    let runtime: Record<string, unknown>;
    try {
      const health = await deps.agent.agentHealth();
      runtime = {
        status: "up",
        agent_state: health.state,
        devices: health.devices,
        active_pipelines: health.active_pipelines,
        observed_at_ms: checkedAtMs,
      };
    } catch (err) {
      if (err instanceof AgentTransportFailure) {
        req.log.warn({ agentFailure: err.causeKind, detail: err.detail }, "agent.health failed");
        runtime = { status: "unreachable", observed_at_ms: checkedAtMs };
      } else {
        throw err;
      }
    }
    let db: Record<string, unknown>;
    if (deps.db === null || deps.db === undefined) {
      db = { status: "not_configured", observed_at_ms: checkedAtMs };
    } else {
      try {
        await deps.db.execute("select 1");
        db = { status: "up", observed_at_ms: checkedAtMs };
      } catch (err) {
        req.log.warn({ err: (err as Error).message }, "db probe failed");
        db = { status: "unreachable", observed_at_ms: checkedAtMs };
      }
    }
    // auth 层依赖 db + secret；其 DB 故障面在 db 层如实呈现，本层只表达
    // 配置存在性（up = Better Auth 实例已构建）。
    const auth: Record<string, unknown> =
      deps.authenticator === null || deps.authenticator === undefined
        ? { status: "not_configured", observed_at_ms: checkedAtMs }
        : { status: "up", observed_at_ms: checkedAtMs };
    // 事件面（CP-01D）：drain 消费者身份如实区分——多实例抢锁失败不冒充正常。
    const events: Record<string, unknown> =
      deps.drainLoop === null || deps.drainLoop === undefined
        ? { status: "not_configured", observed_at_ms: checkedAtMs }
        : { status: deps.drainLoop.status(), observed_at_ms: checkedAtMs };
    return {
      checked_at_ms: checkedAtMs,
      layers: { api: { status: "up" }, runtime, db, auth, events },
    };
  });
}
