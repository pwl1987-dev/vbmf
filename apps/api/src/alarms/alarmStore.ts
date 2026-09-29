/**
 * HI-01A — Alarm 动作应用（drain 点唯一写路径）。
 *
 * 由 ProjectionDrainLoop 在每次 drain 后调用；条件 UPDATE 保持单行 active
 * 语义（partial unique index `alarms_fingerprint_active_idx` 兜底并发）。
 * 本模块只写 `alarms` 表——无任何 Runtime 写回路径（红线）。
 */
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../db/index.ts";
import { alarms } from "../db/schema.ts";
import {
  deriveAlarmActions,
  fingerprintOf,
  type AlarmAction,
} from "./alarmProjection.ts";
import type { AgentProjectionWire } from "../agent/types.ts";

/** upsert 一条 active alarm：存在则更新（复发 → escalating），否则插入。 */
async function applyUpsert(db: Db, action: Extract<AlarmAction, { type: "upsert" }>, count: number): Promise<void> {
  const updated = await db
    .update(alarms)
    .set({
      severity: action.severity,
      summary: action.summary,
      retryable: action.retryable,
      lastSeenAt: new Date(),
      eventCount: sql`${alarms.eventCount} + ${count}`,
      recoveryStatus: action.recurrence ? "escalating" : "active",
      evidence: action.evidence as unknown as object,
    })
    .where(and(eq(alarms.fingerprint, action.fingerprint), eq(alarms.active, true)))
    .returning({ id: alarms.id });
  if (updated.length === 0) {
    await db.insert(alarms).values({
      fingerprint: action.fingerprint,
      severity: action.severity,
      kind: action.kind,
      failureDomain: action.failureDomain,
      relatedSessionId: action.relatedSessionId,
      relatedDeviceId: action.relatedDeviceId,
      relatedPipelineId: action.relatedPipelineId,
      summary: action.summary,
      retryable: action.retryable,
      recoveryStatus: "active",
      eventCount: count,
      active: true,
      evidence: action.evidence as unknown as object,
    });
  }
}

/** clear：恢复观察驱动的落定（只清匹配 fingerprint 的 active 行）。 */
async function applyClear(db: Db, action: Extract<AlarmAction, { type: "clear" }>): Promise<void> {
  await db
    .update(alarms)
    .set({
      active: false,
      clearedAt: new Date(),
      clearReason: action.clearReason,
      recoveryStatus: "recovered",
    })
    .where(and(eq(alarms.fingerprint, action.fingerprint), eq(alarms.active, true)));
}

/** domain 恢复宽路径：清某 kind 的全部 active 行（evidence 快照可审计）。 */
async function applyClearKind(
  db: Db,
  action: Extract<AlarmAction, { type: "clear-kind" }>,
): Promise<void> {
  await db
    .update(alarms)
    .set({
      active: false,
      clearedAt: new Date(),
      clearReason: action.clearReason,
      recoveryStatus: "recovered",
      evidence: action.evidence as unknown as object,
    })
    .where(and(eq(alarms.kind, action.kind), eq(alarms.active, true)));
}

/**
 * drain 投影快照 → alarm 动作并应用。
 * 返回应用的动作数（日志/测试观测用；不作为任何决策输入）。
 */
export async function applyAlarmProjection(db: Db, projection: AgentProjectionWire): Promise<number> {
  const faults = projection.faults ?? [];
  if (faults.length === 0 && Object.keys(projection.session_states).length === 0) {
    return 0;
  }
  const actions = deriveAlarmActions(faults, {
    sessionStates: projection.session_states ?? {},
  });
  // 每 fingerprint 的 fault 条数（event_count 增量）。
  const counts = new Map<string, number>();
  for (const f of faults) {
    const fp = fingerprintOf(f);
    counts.set(fp, (counts.get(fp) ?? 0) + 1);
  }
  for (const action of actions) {
    if (action.type === "upsert") {
      await applyUpsert(db, action, counts.get(action.fingerprint) ?? 1);
    } else if (action.type === "clear") {
      await applyClear(db, action);
    } else {
      await applyClearKind(db, action);
    }
  }
  return actions.length;
}
