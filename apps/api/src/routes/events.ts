/**
 * CP-01D Event API（EXTERNAL_API_CONTRACT §2.1 Event 面 + EVENT_CONTRACT §2
 * Projection 归属 Control Plane + planning C7）。
 *
 * `GET /events/v1/stream` = SSE + cursor：
 * - **Nginx frozen 路由**：`/events/` → fastify（Deployment SoT §11；SSE 要求
 *   `proxy_buffering off` + 长 read timeout——Nginx 层已冻结）。
 * - cursor 语义：`?cursor=<sequence>` 或标准 `Last-Event-ID` 头（浏览器
 *   EventSource 重连自动携带）；缺省 = 从当前 max 之后 live tail；cursor ≤ 0
 *   = 全量重放。投递 at-least-once，consumer 以 `id:`（outbox sequence）去重
 *   （F9 幂等键）。
 * - 弱序如实（F10）：载荷显式 `weak_ordering: true`——投影聚合以事件内容为
 *   准（计数/状态集），无全局事件序。
 * - 数据只来自 `event_outbox`（持久投递事实）；drain 停止（多实例/未配置）
 *   不影响重放与 tail 已有行。
 * - 本路由必须声明 security config（read events·viewer/operator）——CP-01C
 *   fail-closed 钩子覆盖 `/events/*` 产品面前缀。
 */
import type { FastifyInstance } from "fastify";
import { latestOutboxSequence, outboxRowsAfter } from "../events/eventPlane.ts";
import { ROUTE_PERMISSIONS } from "../security/fastifySecurity.ts";
import type { Db } from "../db/index.ts";
import { ApiError, validationError } from "../lib/errors.ts";
import { ROUTE_SCHEMAS } from "./schemas.ts";

export interface EventsRouteDeps {
  db: Db | null;
  /** SSE tail 轮询间隔（毫秒）。 */
  ssePollMs: number;
}

/** 三态 cursor：undefined = live tail（当前 max 之后）；number = 重放该 sequence 之后。 */
function parseCursor(query: unknown, headers: Record<string, unknown>): number | undefined {
  const raw = (query as Record<string, unknown> | null)?.cursor ?? headers["last-event-id"];
  if (raw === undefined || raw === "") return undefined;
  if (typeof raw !== "string") throw validationError("cursor must be a non-negative integer sequence");
  if (!/^\d{1,19}$/.test(raw)) throw validationError("cursor must be a non-negative integer sequence");
  return Number(raw);
}

export async function eventsRoutes(app: FastifyInstance, deps: EventsRouteDeps): Promise<void> {
  const streamSchema = ROUTE_SCHEMAS.find(
    (s) => s.method === "GET" && s.url === "/events/v1/stream",
  )?.schema;
  app.get(
    "/events/v1/stream",
    {
      config: { security: { permission: ROUTE_PERMISSIONS.eventsRead, bucket: "read" } },
      ...(streamSchema !== undefined ? { schema: streamSchema } : {}),
    },
    async (req, reply) => {
      if (deps.db === null) {
        // 事件面持久投递缓冲未配置——诚实 503（fail-closed，不假成功）。
        throw new ApiError(
          "RESOURCE_UNAVAILABLE",
          503,
          "event plane is not configured on this control plane",
          false,
        );
      }
      const cursor = parseCursor(req.query, req.headers);
      const log = req.log;

      reply.hijack();
      const raw = reply.raw;
      raw.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      raw.write("retry: 3000\n\n");

      let last: number;
      try {
        // 显式 cursor = 重放该 sequence 之后（Last-Event-ID 已见的行不重发）；
        // 缺省 = live tail（当前 max 之后）。
        last = cursor !== undefined ? cursor : await latestOutboxSequence(deps.db);
      } catch (err) {
        log.error({ err: (err as Error).message }, "events stream cursor bootstrap failed");
        raw.end();
        return;
      }

      let closed = false;
      let timer: NodeJS.Timeout | null = null;
      const close = (): void => {
        if (closed) return;
        closed = true;
        if (timer !== null) clearInterval(timer);
        timer = null;
        raw.end();
      };
      req.raw.on("close", close);
      req.raw.on("error", close);

      const writeRows = async (): Promise<void> => {
        if (closed || deps.db === null) return;
        try {
          const rows = await outboxRowsAfter(deps.db, last, 200);
          for (const row of rows) {
            const payload = {
              sequence: row.sequence,
              observed_at_ms: row.observedAt.getTime(),
              weak_ordering: true,
              snapshot: row.snapshot,
            };
            raw.write(`id: ${row.sequence}\nevent: projection\ndata: ${JSON.stringify(payload)}\n\n`);
            last = row.sequence;
          }
          if (rows.length === 0 && !closed) {
            raw.write(": heartbeat\n\n");
          }
        } catch (err) {
          log.warn({ err: (err as Error).message }, "events stream tail failed");
        }
      };

      timer = setInterval(() => {
        void writeRows();
      }, deps.ssePollMs);
      // 先做一次即时输出（重放/首心跳），再进入 tail 节奏。
      await writeRows();
    },
  );
}
