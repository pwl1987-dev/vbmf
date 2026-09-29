/**
 * CP-01D Event plane（planning §7 CP-01D 行 + C7 Event API + B9 红线）。
 *
 * - **单消费者 drain（B9 fail-closed）**：`events.projection` 是 agent 进程内
 *   破坏性 drain——多实例同时 drain 会互相偷事件。本包用 PostgreSQL advisory
 *   lock（专用连接持有）保证全部署**恰一个** drain loop；抢锁失败的实例诚实
 *   报 `locked_by_other_instance` 并不 drain（outbox/SSE 只读面多实例安全）。
 * - **outbox**：每次 drain 的聚合投影快照（`AgentProjectionWire` 原样）在
 *   total > 0 时写入 `event_outbox`；`sequence`（bigserial）= SSE cursor 与
 *   consumer 幂等键（F9 at-least-once 重放，consumer 按 sequence 去重）。
 * - **弱序如实（F10）**：投影聚合以事件内容为准（计数/状态集），无全局事件
 *   序——SSE 载荷显式 `weak_ordering: true`。
 * - **诚实边界（不冒充 exactly-once）**：agent drain 无 ack，drain 与 outbox
 *   插入非跨进程原子——Fastify 崩溃窗口内的投影样本会丢失；这是 bounded
 *   packet 的登记限制（agent 侧 durable 事件面属独立未来包）。
 * - RuntimeEvent 原文不出 agent（internal wire 只给聚合）——RuntimeEvent ≠
 *   External Event 边界由 wire 形态结构性保持；outbox 绝不成为 Runtime truth。
 */
import type { AgentControlClient } from "../agent/agentControlClient.ts";
import type { Db } from "../db/index.ts";
import { eventOutbox } from "../db/schema.ts";
import { gt, asc, sql } from "drizzle-orm";
import type pg from "pg";
import type { AgentProjectionWire } from "../agent/types.ts";
import { applyAlarmProjection } from "../alarms/alarmStore.ts";

/** advisory lock key（任意常量；"VBMF-EVENTS" 的 32 位折叠）。 */
const EVENT_DRAIN_LOCK_KEY = 0x56424d46;

export type DrainLoopStatus =
  | "not_started"
  | "running"
  | "locked_by_other_instance"
  | "stopped";

export interface OutboxRow {
  sequence: number;
  observedAt: Date;
  snapshot: AgentProjectionWire;
}

export interface EventPlaneDeps {
  db: Db;
  pool: pg.Pool;
  agent: AgentControlClient;
  /** drain 轮询间隔（毫秒）。 */
  pollMs: number;
  /** outbox 保留窗（毫秒；0 = 不清理）。 */
  retentionMs: number;
  /** 测试注入等待。 */
  sleep?: (ms: number) => Promise<void>;
  log?: { warn: (o: object, m: string) => void; info: (o: object, m: string) => void; error: (o: object, m: string) => void };
}

export class ProjectionDrainLoop {
  private readonly db: Db;
  private readonly pool: pg.Pool;
  private readonly agent: AgentControlClient;
  private readonly pollMs: number;
  private readonly retentionMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly log: NonNullable<EventPlaneDeps["log"]>;

  private statusValue: DrainLoopStatus = "not_started";
  private lockClient: pg.PoolClient | null = null;
  private stopRequested = false;
  private ticker: NodeJS.Timeout | null = null;

  constructor(deps: EventPlaneDeps) {
    this.db = deps.db;
    this.pool = deps.pool;
    this.agent = deps.agent;
    this.pollMs = deps.pollMs;
    this.retentionMs = deps.retentionMs;
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.log = deps.log ?? {
      warn: () => {},
      info: () => {},
      error: () => {},
    };
  }

  status(): DrainLoopStatus {
    return this.statusValue;
  }

  /**
   * 尝试成为唯一 drain 消费者。抢锁失败 = 另一实例在 drain（B9 fail-closed，
   * 绝不并发 drain）；返回后事件面只读路径（SSE outbox 重放）仍然可用。
   */
  async start(): Promise<DrainLoopStatus> {
    if (this.statusValue === "running") return this.statusValue;
    this.stopRequested = false;
    const client = await this.pool.connect();
    const res = await client.query<{ locked: boolean }>(
      "select pg_try_advisory_lock($1) as locked",
      [EVENT_DRAIN_LOCK_KEY],
    );
    if (!res.rows[0]?.locked) {
      client.release();
      this.statusValue = "locked_by_other_instance";
      this.log.warn({ lockKey: EVENT_DRAIN_LOCK_KEY }, "event drain lock held by another instance; drain disabled");
      return this.statusValue;
    }
    this.lockClient = client;
    this.statusValue = "running";
    void this.runLoop();
    return this.statusValue;
  }

  private async runLoop(): Promise<void> {
    while (!this.stopRequested) {
      try {
        const projection = await this.agent.projectEvents();
        if (projection.total > 0) {
          await this.db.insert(eventOutbox).values({
            snapshot: projection as unknown as object,
          });
          // HI-01A: 同一 drain 的 fault 摘要 → alarm 投影（无 Runtime 写回；
          // 失败仅记日志，不影响 outbox/drain 主路径）。
          try {
            await applyAlarmProjection(this.db, projection);
          } catch (alarmErr) {
            this.log.warn({ err: (alarmErr as Error).message }, "alarm projection apply failed");
          }
        }
        if (this.retentionMs > 0) {
          await this.db.execute(
            sql`delete from event_outbox where observed_at < now() - (${this.retentionMs} * interval '1 millisecond')`,
          );
        }
      } catch (err) {
        // agent 不可达/DB 抖动：记录并下个 tick 重试；drain 消费者身份保持
        // （advisory lock 在专用连接上持续持有）。
        this.log.warn({ err: (err as Error).message }, "event projection drain tick failed");
      }
      await this.sleep(this.pollMs);
    }
  }

  async stop(): Promise<void> {
    this.stopRequested = true;
    if (this.ticker !== null) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
    if (this.lockClient !== null) {
      try {
        await this.lockClient.query("select pg_advisory_unlock($1)", [EVENT_DRAIN_LOCK_KEY]);
      } finally {
        this.lockClient.release();
        this.lockClient = null;
      }
    }
    if (this.statusValue === "running") this.statusValue = "stopped";
  }
}

export async function latestOutboxSequence(db: Db): Promise<number> {
  const res = await db.execute<{ max: string | null }>(sql`select coalesce(max(sequence), 0) as max from event_outbox`);
  const rows = (res as unknown as { rows: { max: string | null }[] }).rows;
  return Number(rows[0]?.max ?? "0");
}

/** cursor 之后（不含）的 outbox 行，升序；cursor ≤ 0 表示从起点重放。 */
export async function outboxRowsAfter(db: Db, cursor: number, limit = 200): Promise<OutboxRow[]> {
  const condition = cursor > 0 ? gt(eventOutbox.sequence, cursor) : undefined;
  const q = db
    .select({
      sequence: eventOutbox.sequence,
      observedAt: eventOutbox.observedAt,
      snapshot: eventOutbox.snapshot,
    })
    .from(eventOutbox)
    .orderBy(asc(eventOutbox.sequence))
    .limit(limit);
  return (condition !== undefined ? q.where(condition) : q) as Promise<OutboxRow[]>;
}
