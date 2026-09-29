/**
 * Four-state machine (WCE-01C · §7 task spec)。
 *
 * 每个 operator 触发的命令旅程有 4 个明确分离的状态：
 *
 *   Desired   — operator 在 UI 上表达的"我想要"（如 Start Session X）
 *   Requested — HTTP POST /api/v1/sessions 收到响应（command_id 已分配）
 *   Executing — agent/Runtime 正在执行（GET /api/v1/commands/:id state=pending
 *               或 session.state/phase 处于过渡态）
 *   Observed  — Runtime 实际状态（来自 /api/v1/runtime snapshot）
 *
 * 关键红线：
 * - 任何 transition 必须有显式证据（HTTP 响应 / Runtime snapshot）；
 * - HTTP 200 ≠ Runtime success：Requested → Executing 仅当 state/phase
 *   证明执行尚未收敛；
 * - Runtime 实际状态 ≠ Desired 时 UI 必须显式提示 divergence；
 * - 终态（completed/failed/timeout/conflict/rejected）属于 Observed 的实现
 *   路径之一，不允许"假装成功"。
 */
import type { CommandOperationBody, CommandState, RuntimeSnapshot, SessionPhase, SessionState } from "../api/schemas.ts";

export type FourPhase = "Desired" | "Requested" | "Executing" | "Observed";

export interface FourState {
  desired: SessionState | "Running" | "Stopped" | "Released" | null;
  requested: CommandOperationBody | null;
  executing: { state: CommandState; phase?: SessionPhase } | null;
  observed: SessionState | "Unknown" | null;
  divergence: boolean;
  lastTransition: FourPhase | null;
}

export type FourStateEvent =
  | { kind: "DESIRE"; target: NonNullable<FourState["desired"]> }
  | { kind: "REQUESTED"; command: CommandOperationBody }
  | { kind: "EXECUTING"; state: CommandState; phase?: SessionPhase }
  | { kind: "OBSERVE"; runtime: RuntimeSnapshot | null; sessionId: string | null }
  | { kind: "RESET" };

export function initialFourState(): FourState {
  return {
    desired: null,
    requested: null,
    executing: null,
    observed: null,
    divergence: false,
    lastTransition: null,
  };
}

/** 不允许 mutation：每次返回新对象。 */
export function reduceFourState(prev: FourState, event: FourStateEvent): FourState {
  switch (event.kind) {
    case "DESIRE":
      return {
        ...prev,
        desired: event.target,
        lastTransition: "Desired",
      };
    case "REQUESTED":
      return {
        ...prev,
        requested: event.command,
        executing:
          event.command.state === "pending"
            ? { state: "pending" }
            : deriveExecutingFromCommand(event.command.state),
        lastTransition: "Requested",
      };
    case "EXECUTING":
      return {
        ...prev,
        executing: { state: event.state, ...(event.phase !== undefined ? { phase: event.phase } : {}) },
        lastTransition: "Executing",
      };
    case "OBSERVE": {
      const observed = observedFromRuntime(event.runtime, event.sessionId);
      const divergence = computeDivergence(prev.desired, observed);
      return {
        ...prev,
        observed,
        divergence,
        lastTransition: "Observed",
      };
    }
    case "RESET":
      return initialFourState();
  }
}

function deriveExecutingFromCommand(state: CommandState): { state: CommandState; phase?: SessionPhase } {
  if (state === "pending") return { state: "pending" };
  return { state };
}

function observedFromRuntime(runtime: RuntimeSnapshot | null, sessionId: string | null): SessionState | "Unknown" {
  if (runtime === null || sessionId === null) return "Unknown";
  const s = runtime.sessions.find((x) => x.id === sessionId);
  if (s === undefined) return "Unknown";
  return s.state;
}

function computeDivergence(desired: FourState["desired"], observed: SessionState | "Unknown"): boolean {
  if (desired === null || observed === "Unknown") return false;
  switch (desired) {
    case "Running":
      return observed !== "running";
    case "Stopped":
    case "Released":
      return observed !== "released" && observed !== "terminated";
    default:
      return observed !== desired;
  }
}

/** 给 UI 用的稳定字符串描述（红/绿/灰指示）。 */
export function describeFourState(state: FourState): string {
  const parts: string[] = [];
  parts.push(`desired=${state.desired ?? "—"}`);
  parts.push(`requested=${state.requested?.state ?? "—"}`);
  parts.push(`executing=${state.executing?.state ?? "—"}`);
  parts.push(`observed=${state.observed ?? "—"}`);
  if (state.divergence) parts.push("DIVERGENT");
  return parts.join(" | ");
}
