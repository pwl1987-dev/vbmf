/**
 * HEALTH-INCIDENT-ENTRY-01 HI-01A — Alarm 投影引擎（纯函数）。
 *
 * 输入 = agent `events.projection` 的 faults 摘要块（canonical 照抄，D1 wire）
 * + drain 时的恢复观察（session_states / kind 计数）；输出 = 对 `alarms` 表的
 * 机械动作。**Alarm 是投影层派生事实，不是 Runtime truth**——本模块无任何
 * 写回 Runtime 的路径；恢复决策归 Runtime/Supervisor/canonical command。
 *
 * 规则（planning D3，全部可从 evidence 审计）：
 * - fault digest → 开 alarm 或更新既有 active 行（fingerprint 去重；
 *   重触发 → last_seen/event_count 更新 + recovery_status=escalating）。
 * - 恢复观察 → clear 候选：同 fingerprint 的 related session 出现
 *   恢复态（session_states 值为 running/…非失败终态）且本 drain 内该
 *   fingerprint 无新 fault ⇒ 该行可清（recovered）。
 * - manual-required 类（hardware_fault / ambiguous_identity /
 *   retryable=false 的 pipeline_fault / session_failed）不因观察窗口自动清，
 *   仅由恢复观察（D3 规则）清——与"绝不自动超时消失"一致。
 * - ACK 不在任何规则内（awareness only；由 API 层独立写 ack_* 三字段）。
 */

import type { AgentFaultDigest } from "../agent/types.ts";

/** 机械失败域映射（kind → domain；无翻译判断）。 */
export function failureDomainOf(kind: string): string {
  switch (kind) {
    case "pipeline_fault":
      return "pipeline";
    case "hardware_fault":
      return "hardware";
    case "ambiguous_identity":
      return "identity";
    case "session_failed":
      return "session";
    default:
      return "resource";
  }
}

/** 机械严重级映射（retryable pipeline fault=warning；其余 fault=error）。 */
export function severityOf(digest: AgentFaultDigest): "warning" | "error" {
  if (digest.kind === "pipeline_fault" && digest.retryable === true) return "warning";
  return "error";
}

/** 派生去重键：kind + failure_domain + related 主标识。 */
export function fingerprintOf(digest: AgentFaultDigest): string {
  const related =
    digest.session_id ?? digest.device_id ?? digest.pipeline ?? "unattributed";
  return `${digest.kind}:${failureDomainOf(digest.kind)}:${related}`;
}

/** drains 间恢复观察（最小：本 drain 的 session_states 终值）。 */
export interface RecoveryObservation {
  /** session_id → 最新态（agent 投影照抄）。 */
  sessionStates: Record<string, string>;
}

/** 恢复态判定（机械词表：非失败终态视为恢复信号）。 */
const RECOVERED_SESSION_STATES = new Set([
  "running",
  "released",
  "completed",
]);

/** 对单个 digest 的表动作（纯数据；应用层负责 SQL）。 */
export type AlarmAction =
  | {
      type: "upsert";
      fingerprint: string;
      severity: "warning" | "error";
      kind: string;
      failureDomain: string;
      relatedSessionId: string | null;
      relatedDeviceId: string | null;
      relatedPipelineId: string | null;
      summary: string;
      retryable: boolean | null;
      /** 同 fingerprint 复发（已有 active 行时应转 escalating）。 */
      recurrence: boolean;
      evidence: AgentFaultDigest;
    }
  | {
      /** 由恢复观察驱动的 clear（只作用于匹配 related session 的 active 行）。 */
      type: "clear";
      fingerprint: string;
      clearReason: "recovered";
      evidence: { session_id: string; state: string };
    }
  | {
      /** domain 恢复宽路径：清某 kind 的全部 active 行（evidence 记录观察）。 */
      type: "clear-kind";
      kind: string;
      clearReason: "recovered";
      evidence: { observed: Array<{ session_id: string; state: string }> };
    };

/**
 * 纯函数：一次 drain 的 (faults, 恢复观察) → 动作序列。
 * 同 drain 内同 fingerprint 多条 fault → 单个 upsert（recurrence=true，
 * event_count 增量由应用层按条数累加）。恢复观察只对**本 drain 无新 fault**
 * 的 fingerprint 产生 clear（有新 fault 则 upsert 优先，不产生 clear）。
 */
export function deriveAlarmActions(
  faults: AgentFaultDigest[],
  observation: RecoveryObservation,
): AlarmAction[] {
  const byFingerprint = new Map<string, AgentFaultDigest[]>();
  for (const f of faults) {
    const fp = fingerprintOf(f);
    const list = byFingerprint.get(fp) ?? [];
    list.push(f);
    byFingerprint.set(fp, list);
  }

  const actions: AlarmAction[] = [];
  for (const [fp, list] of byFingerprint) {
    // 最新 digest 决定展示字段；全部 digest 计数由应用层累加。
    const latest = list[list.length - 1]!;
    actions.push({
      type: "upsert",
      fingerprint: fp,
      severity: severityOf(latest),
      kind: latest.kind,
      failureDomain: failureDomainOf(latest.kind),
      relatedSessionId: latest.session_id ?? null,
      relatedDeviceId: latest.device_id ?? null,
      relatedPipelineId: latest.pipeline ?? null,
      summary: latest.summary,
      retryable:
        latest.kind === "pipeline_fault" ? (latest.retryable ?? null) : null,
      recurrence: list.length > 1,
      evidence: latest,
    });
  }

  // 恢复观察 → clear。两条互补规则（evidence 各自记录判定输入，可审计）：
  // ① 同 session 恢复态（窄路径：失败 session 复活并回到恢复态）；
  // ② domain 恢复（宽路径：失败 session 已消亡不再发事件，操作员重建了
  //    running 会话 = 该故障域恢复——本 drain 无新 session_failed 且观察到
  //    任一 session 处于恢复态时，清全部 active 的 session_failed）。
  //    hardware/ambiguous/pipeline fault 不适用宽路径（各自 domain 恢复
  //    语义不同——hardware 需设备级恢复信号，保持 manual-required 纪律）。
  const faultSessionIds = new Set(
    faults.map((f) => f.session_id).filter((s): s is string => s !== null && s !== undefined),
  );
  const runningSessions: Array<{ session_id: string; state: string }> = [];
  for (const [sessionId, state] of Object.entries(observation.sessionStates)) {
    if (!RECOVERED_SESSION_STATES.has(state)) continue;
    runningSessions.push({ session_id: sessionId, state });
    if (faultSessionIds.has(sessionId)) continue;
    actions.push({
      type: "clear",
      fingerprint: `session_failed:session:${sessionId}`,
      clearReason: "recovered",
      evidence: { session_id: sessionId, state },
    });
  }
  const hasNewSessionFault = faults.some((f) => f.kind === "session_failed");
  if (runningSessions.length > 0 && !hasNewSessionFault) {
    actions.push({
      type: "clear-kind",
      kind: "session_failed",
      clearReason: "recovered",
      evidence: { observed: runningSessions },
    });
  }
  return actions;
}
