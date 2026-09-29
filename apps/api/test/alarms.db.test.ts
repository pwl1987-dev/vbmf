/**
 * HI-01A store tests — applyAlarmProjection 的 SQL 路径（ephemeral PG）。
 * 纯函数路径见 alarms.projection.test.ts。运行：DATABASE_TEST_URL=… npm run test:db
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { createDb, runMigrations, type Db } from "../src/db/index.ts";
import { alarms } from "../src/db/schema.ts";
import { applyAlarmProjection } from "../src/alarms/alarmStore.ts";
import type { AgentProjectionWire } from "../src/agent/types.ts";

const DB_URL = process.env.DATABASE_TEST_URL;
const hasDb = DB_URL !== undefined && DB_URL !== "";
const dbTest = (name: string, fn: () => Promise<void>) =>
  test(name, { skip: !hasDb }, fn);

const session = "11111111-1111-1111-1111-111111111111";
const device = "22222222-2222-2222-2222-222222222222";
const pipeline = "33333333-3333-3333-3333-333333333333";

function projection(
  faults: AgentProjectionWire["faults"],
  sessionStates: Record<string, string> = {},
): AgentProjectionWire {
  return {
    snapshot_kind: "event_projection_snapshot",
    total: 1,
    kind_counts: {},
    session_states: sessionStates,
    session_failures: {},
    has_critical: (faults?.length ?? 0) > 0,
    ...(faults !== undefined ? { faults } : {}),
  };
}

async function freshDb(): Promise<{ db: Db; end: () => Promise<void> }> {
  const { db, pool } = createDb(DB_URL!);
  await runMigrations(db);
  await db.execute(
    sql`truncate table ${alarms}, event_outbox, audit_entries, commands, auth_user, api_keys, auth_session, auth_account, auth_verification`,
  );
  return { db, end: () => pool.end() };
}

dbTest("hi01a store: 首次 fault → insert active alarm（字段/严重级/related 如实）", async () => {
  const { db, end } = await freshDb();
  try {
    const n = await applyAlarmProjection(
      db,
      projection([
        { kind: "pipeline_fault", pipeline, summary: "bus error", retryable: true },
      ]),
    );
    assert.equal(n, 1);
    const rows = await db.select().from(alarms);
    assert.equal(rows.length, 1);
    const a = rows[0]!;
    assert.equal(a.active, true);
    assert.equal(a.severity, "warning");
    assert.equal(a.kind, "pipeline_fault");
    assert.equal(a.failureDomain, "pipeline");
    assert.equal(a.relatedPipelineId, pipeline);
    assert.equal(a.eventCount, 1);
    assert.equal(a.recoveryStatus, "active");
    assert.equal(a.ackAt, null, "alarm 无 ACK 起点（awareness 由 API 层独立写）");
  } finally {
    await end();
  }
});

dbTest("hi01a store: 复发 → 同行更新 + escalating + event_count 累加", async () => {
  const { db, end } = await freshDb();
  try {
    const fault = { kind: "pipeline_fault", pipeline, summary: "x", retryable: true };
    await applyAlarmProjection(db, projection([fault]));
    await applyAlarmProjection(db, projection([fault, fault]));
    const rows = await db.select().from(alarms);
    assert.equal(rows.length, 1, "同 fingerprint 保持单行 active");
    const a = rows[0]!;
    assert.equal(a.eventCount, 3);
    assert.equal(a.recoveryStatus, "escalating");
  } finally {
    await end();
  }
});

dbTest("hi01a store: 恢复观察 → clear（active=false, recovered）；复发 → 新行接管", async () => {
  const { db, end } = await freshDb();
  try {
    await applyAlarmProjection(
      db,
      projection([{ kind: "session_failed", session_id: session, summary: "fail" }]),
    );
    // 恢复观察（无新 fault）：clear。
    await applyAlarmProjection(db, projection([], { [session]: "released" }));
    let rows = await db.select().from(alarms);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.active, false);
    assert.equal(rows[0]!.recoveryStatus, "recovered");
    assert.ok(rows[0]!.clearedAt !== null);

    // 复发：历史行保留，新 active 行接管。
    await applyAlarmProjection(
      db,
      projection([{ kind: "session_failed", session_id: session, summary: "fail again" }]),
    );
    rows = await db.select().from(alarms);
    assert.equal(rows.length, 2);
    const activeRows = rows.filter((r) => r.active);
    assert.equal(activeRows.length, 1);
    assert.equal(activeRows[0]!.summary, "fail again");
  } finally {
    await end();
  }
});

dbTest("hi01a store: manual-required 类不被观察自动清（hardware fault 无恢复信号路径）", async () => {
  const { db, end } = await freshDb();
  try {
    await applyAlarmProjection(
      db,
      projection([{ kind: "hardware_fault", device_id: device, summary: "decklink lost" }]),
    );
    // 无 related session 的恢复观察不可能匹配 hardware fingerprint → 永不清。
    await applyAlarmProjection(db, projection([], { [session]: "running" }));
    const rows = await db.select().from(alarms);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.active, true, "hardware fault 只能由显式恢复事件（未来 wire）清");
  } finally {
    await end();
  }
});

dbTest("hi01a store: 空 faults 心跳 → 零动作不触碰表", async () => {
  const { db, end } = await freshDb();
  try {
    const n = await applyAlarmProjection(db, projection([]));
    assert.equal(n, 0);
    const rows = await db.select().from(alarms);
    assert.equal(rows.length, 0);
  } finally {
    await end();
  }
});
