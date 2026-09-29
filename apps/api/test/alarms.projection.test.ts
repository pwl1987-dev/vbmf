/**
 * HI-01A focused tests — alarm projection pure functions.
 * 存储路径（applyAlarmProjection 的 SQL）在 db.test.ts（ephemeral PG）覆盖。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveAlarmActions,
  failureDomainOf,
  fingerprintOf,
  severityOf,
} from "../src/alarms/alarmProjection.ts";
import type { AgentFaultDigest } from "../src/agent/types.ts";

const session = "11111111-1111-1111-1111-111111111111";
const device = "22222222-2222-2222-2222-222222222222";
const pipeline = "33333333-3333-3333-3333-333333333333";

function digest(over: Partial<AgentFaultDigest>): AgentFaultDigest {
  return { kind: "pipeline_fault", summary: "s", ...over };
}

test("hi01a: failure domain 机械映射", () => {
  assert.equal(failureDomainOf("pipeline_fault"), "pipeline");
  assert.equal(failureDomainOf("hardware_fault"), "hardware");
  assert.equal(failureDomainOf("ambiguous_identity"), "identity");
  assert.equal(failureDomainOf("session_failed"), "session");
  assert.equal(failureDomainOf("anything_else"), "resource");
});

test("hi01a: severity — retryable pipeline fault=warning，其余=error", () => {
  assert.equal(severityOf(digest({ retryable: true })), "warning");
  assert.equal(severityOf(digest({ retryable: false })), "error");
  assert.equal(severityOf(digest({ kind: "hardware_fault", retryable: null })), "error");
  assert.equal(
    severityOf(digest({ kind: "session_failed", session_id: session })),
    "error",
  );
});

test("hi01a: fingerprint — kind+domain+related 主标识去重键", () => {
  assert.equal(
    fingerprintOf(digest({ pipeline })),
    `pipeline_fault:pipeline:${pipeline}`,
  );
  assert.equal(
    fingerprintOf(digest({ kind: "session_failed", session_id: session, pipeline: null })),
    `session_failed:session:${session}`,
  );
  assert.equal(
    fingerprintOf(digest({ kind: "hardware_fault", device_id: device, pipeline: null })),
    `hardware_fault:hardware:${device}`,
  );
});

test("hi01a: 首次 fault → 单个 upsert（recurrence=false）", () => {
  const actions = deriveAlarmActions(
    [digest({ pipeline, summary: "bus error", retryable: true })],
    { sessionStates: {} },
  );
  assert.equal(actions.length, 1);
  const a = actions[0]!;
  assert.equal(a.type, "upsert");
  if (a.type === "upsert") {
    assert.equal(a.severity, "warning");
    assert.equal(a.failureDomain, "pipeline");
    assert.equal(a.relatedPipelineId, pipeline);
    assert.equal(a.retryable, true);
    assert.equal(a.recurrence, false);
  }
});

test("hi01a: 同 drain 同 fingerprint 多条 → 单 upsert recurrence=true", () => {
  const d = digest({ pipeline, summary: "x", retryable: true });
  const actions = deriveAlarmActions([d, d], { sessionStates: {} });
  assert.equal(actions.length, 1);
  assert.equal(actions[0]!.type, "upsert");
  if (actions[0]!.type === "upsert") assert.equal(actions[0]!.recurrence, true);
});

test("hi01a: 恢复观察 → session_failed alarm 被 clear（recovered）", () => {
  const actions = deriveAlarmActions(
    [digest({ kind: "session_failed", session_id: session, summary: "fail", pipeline: null })],
    { sessionStates: { [session]: "released" } },
  );
  // 同 drain 该 session 有新 fault → upsert 优先，无同 session clear。
  assert.equal(actions.filter((a) => a.type === "upsert").length, 1);
  // 但 domain 宽路径不适用（有新 session_failed）。
  assert.equal(actions.some((a) => a.type === "clear-kind"), false);

  // 下一 drain 无新 fault + 同 session 恢复态 → 窄路径 clear。
  const clearActions = deriveAlarmActions([], { sessionStates: { [session]: "released" } });
  const narrow = clearActions.find((a) => a.type === "clear");
  assert.ok(narrow !== undefined, "narrow clear present");
  if (narrow!.type === "clear") {
    assert.equal(narrow.fingerprint, `session_failed:session:${session}`);
    assert.equal(narrow.clearReason, "recovered");
  }
});

test("hi01a: domain 宽路径 — 无新 session_failed + 任一 running 会话 → clear-kind", () => {
  const other = "99999999-9999-9999-9999-999999999999";
  const actions = deriveAlarmActions([], { sessionStates: { [other]: "running" } });
  const wide = actions.find((a) => a.type === "clear-kind");
  assert.ok(wide !== undefined, "clear-kind present");
  if (wide!.type === "clear-kind") {
    assert.equal(wide.kind, "session_failed");
    assert.equal(wide.evidence.observed.length, 1);
  }
  // 有新 session_failed 时宽路径关闭。
  const blocked = deriveAlarmActions(
    [digest({ kind: "session_failed", session_id: other, summary: "x", pipeline: null })],
    { sessionStates: { [other]: "running" } },
  );
  assert.equal(blocked.some((a) => a.type === "clear-kind"), false);
});

test("hi01a: 非恢复态观察不产生 clear", () => {
  const actions = deriveAlarmActions([], { sessionStates: { [session]: "failed" } });
  assert.equal(actions.length, 0);
});

test("hi01a: manual-required 类字段如实携带（hardware/ambiguous 无 retryable）", () => {
  const actions = deriveAlarmActions(
    [
      digest({ kind: "hardware_fault", device_id: device, summary: "decklink lost", pipeline: null, retryable: null }),
      digest({ kind: "ambiguous_identity", device_id: device, summary: "amb", pipeline: null, retryable: null }),
    ],
    { sessionStates: {} },
  );
  assert.equal(actions.length, 2);
  for (const a of actions) {
    if (a.type !== "upsert") continue;
    assert.equal(a.severity, "error");
    assert.equal(a.retryable, null);
  }
});

test("hi01a: 空 faults + 空观察 → 零动作（drain 心跳不触碰 alarms）", () => {
  assert.equal(deriveAlarmActions([], { sessionStates: {} }).length, 0);
});
