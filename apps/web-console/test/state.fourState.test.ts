/**
 * Four-state machine reducer tests (WCE-01C · §7)。
 * 覆盖：DESIRE→REQUESTED→EXECUTING→OBSERVE 全链；divergence 触发；终态
 * 收敛；RESET。
 */
import { describe, expect, it } from "vitest";
import {
  initialFourState,
  reduceFourState,
  describeFourState,
  type FourState,
} from "../src/state/fourStateMachine.ts";
import type { CommandOperationBody, RuntimeSnapshot } from "../src/api/schemas.ts";

function command(state: "pending" | "completed" | "failed" | "timeout"): CommandOperationBody {
  return {
    command_id: "00000000-0000-0000-0000-0000000000aa",
    state,
    kind: "start_session",
    created_at: new Date().toISOString(),
  };
}

function snapshotWith(states: Array<"reserved" | "running" | "released" | "terminated" | "failed">): RuntimeSnapshot {
  return {
    devices: [],
    ports: [],
    resources: [],
    sessions: states.map((s, i) => ({
      id: `00000000-0000-0000-0000-00000000000${i}`,
      label: `session-${i.toString().padStart(32, "0")}`,
      state: s,
      phase: s === "running" ? "running" : "released",
      outputs: [],
      inputs: [],
    })),
    capabilities: [],
    program_switch: null,
    generated_at_ms: 1,
    observation_revision: 1,
    observation_lineage: "00000000-0000-0000-0000-0000000000bb",
  };
}

describe("reduceFourState", () => {
  it("starts in initial state with no desired/requested/executing/observed", () => {
    const s = initialFourState();
    expect(s.desired).toBeNull();
    expect(s.requested).toBeNull();
    expect(s.executing).toBeNull();
    expect(s.observed).toBeNull();
    expect(s.divergence).toBe(false);
  });

  it("DESIRE → Running sets desired and lastTransition=Desired", () => {
    const s = reduceFourState(initialFourState(), { kind: "DESIRE", target: "Running" });
    expect(s.desired).toBe("Running");
    expect(s.lastTransition).toBe("Desired");
  });

  it("REQUESTED with pending command sets executing=pending", () => {
    const s = reduceFourState(initialFourState(), { kind: "REQUESTED", command: command("pending") });
    expect(s.requested?.state).toBe("pending");
    expect(s.executing?.state).toBe("pending");
  });

  it("REQUESTED with completed command transitions executing=completed", () => {
    const s = reduceFourState(initialFourState(), { kind: "REQUESTED", command: command("completed") });
    expect(s.executing?.state).toBe("completed");
  });

  it("OBSERVE updates observed from runtime snapshot", () => {
    let s: FourState = initialFourState();
    s = reduceFourState(s, { kind: "DESIRE", target: "Running" });
    s = reduceFourState(s, { kind: "REQUESTED", command: command("completed") });
    s = reduceFourState(s, { kind: "OBSERVE", runtime: snapshotWith(["running"]), sessionId: "00000000-0000-0000-0000-000000000000" });
    expect(s.observed).toBe("running");
    expect(s.divergence).toBe(false);
  });

  it("OBSERVE flags divergence when desired=Running but observed=running≠yet", () => {
    let s: FourState = initialFourState();
    s = reduceFourState(s, { kind: "DESIRE", target: "Running" });
    s = reduceFourState(s, { kind: "OBSERVE", runtime: snapshotWith(["reserved"]), sessionId: "00000000-0000-0000-0000-000000000000" });
    expect(s.divergence).toBe(true);
  });

  it("OBSERVE: unknown runtime yields observed=Unknown, no divergence", () => {
    let s: FourState = initialFourState();
    s = reduceFourState(s, { kind: "DESIRE", target: "Running" });
    s = reduceFourState(s, { kind: "OBSERVE", runtime: null, sessionId: null });
    expect(s.observed).toBe("Unknown");
    expect(s.divergence).toBe(false);
  });

  it("RESET clears all state", () => {
    let s: FourState = initialFourState();
    s = reduceFourState(s, { kind: "DESIRE", target: "Running" });
    s = reduceFourState(s, { kind: "REQUESTED", command: command("completed") });
    s = reduceFourState(s, { kind: "RESET" });
    expect(s).toEqual(initialFourState());
  });

  it("describeFourState returns a non-empty string with all phases", () => {
    const desc = describeFourState(initialFourState());
    expect(desc).toContain("desired");
    expect(desc).toContain("requested");
    expect(desc).toContain("executing");
    expect(desc).toContain("observed");
  });

  it("describeFourState shows DIVERGENT marker when divergence=true", () => {
    let s: FourState = initialFourState();
    s = reduceFourState(s, { kind: "DESIRE", target: "Running" });
    s = reduceFourState(s, { kind: "OBSERVE", runtime: snapshotWith(["released"]), sessionId: "00000000-0000-0000-0000-000000000000" });
    expect(describeFourState(s)).toContain("DIVERGENT");
  });
});
