// @vitest-environment jsdom
/**
 * SessionsPage 页面生命周期 regression（WEB-CONSOLE-BMD-ACCEPTANCE-01 BUG-B）。
 *
 * 机械证明：
 *  1. mount → getRuntime 恰好 1 次（immediate refresh once）
 *  2. React state 更新（runtime snapshot / four-state dispatch / rows 更新）
 *     不得触发额外请求（无请求风暴）
 *  3. advance 1999ms → 仍为 1；到 2000ms → 2；再 2000ms → 3（2s cadence）
 *  4. Start/Stop/Release 的 command polling（getCommand 500ms）与 runtime
 *     snapshot polling 独立，不互相制造 timer storm
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CommandOperationBody, RuntimeSnapshot } from "../src/api/schemas.ts";

const h = vi.hoisted(() => {
  let runtimeCalls = 0;
  let commandCalls = 0;
  let commandPendingSteps = 0;
  let snapshot: RuntimeSnapshot | null = null;
  const startCalls: unknown[] = [];
  const stopCalls: string[] = [];
  const releaseCalls: string[] = [];
  const reset = (): void => {
    runtimeCalls = 0;
    commandCalls = 0;
    commandPendingSteps = 0;
    snapshot = null;
    startCalls.length = 0;
    stopCalls.length = 0;
    releaseCalls.length = 0;
  };
  return {
    reset,
    startCalls,
    stopCalls,
    releaseCalls,
    get runtimeCalls() {
      return runtimeCalls;
    },
    get commandCalls() {
      return commandCalls;
    },
    set commandPendingSteps(n: number) {
      commandPendingSteps = n;
    },
    setSnapshot(s: RuntimeSnapshot): void {
      snapshot = s;
    },
    get snapshot() {
      return snapshot;
    },
    bumpRuntime(): void {
      runtimeCalls += 1;
    },
    nextCommand(commandId: string): CommandOperationBody {
      commandCalls += 1;
      const state = commandCalls <= commandPendingSteps ? "pending" : "completed";
      return {
        command_id: commandId,
        state,
        kind: "start_session",
        created_at: "2026-09-29T00:00:00.000Z",
        ...(state === "completed" ? { terminal_at: "2026-09-29T00:00:01.000Z" } : {}),
      };
    },
  };
});

vi.mock("../src/api/client.ts", () => ({
  ApiClientError: class ApiClientError extends Error {},
  getRuntime: async () => {
    h.bumpRuntime();
    if (h.snapshot === null) {
      return {
        kind: "error" as const,
        status: 503,
        envelope: { error: { code: "DEPENDENCY_UNAVAILABLE", message: "agent down", request_id: "t", retryable: true } },
      };
    }
    return { kind: "ok" as const, status: 200, body: h.snapshot };
  },
  getCommand: async (commandId: string) => ({ kind: "ok" as const, status: 200, body: h.nextCommand(commandId) }),
  postStartSession: async (body: unknown) => {
    h.startCalls.push(body);
    return {
      kind: "ok" as const,
      status: 200,
      body: {
        command_id: "cmd-start-1",
        state: "pending",
        kind: "start_session",
        created_at: "2026-09-29T00:00:00.000Z",
      },
    };
  },
  postStopSession: async (sessionId: string) => {
    h.stopCalls.push(sessionId);
    return {
      kind: "ok" as const,
      status: 200,
      body: { command_id: "cmd-stop-1", state: "pending", kind: "stop_session", created_at: "2026-09-29T00:00:00.000Z" },
    };
  },
  postReleaseSession: async (sessionId: string) => {
    h.releaseCalls.push(sessionId);
    return {
      kind: "ok" as const,
      status: 200,
      body: { command_id: "cmd-rel-1", state: "pending", kind: "release_session", created_at: "2026-09-29T00:00:00.000Z" },
    };
  },
}));

import { SessionsPage } from "../src/pages/SessionsPage.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeSnapshot(sessionStates: string[]): RuntimeSnapshot {
  return {
    devices: [],
    ports: [],
    resources: [],
    sessions: sessionStates.map((state, i) => ({
      id: `sess-${i + 1}`,
      label: `test-session-${i + 1}`,
      state: state as RuntimeSnapshot["sessions"][number]["state"],
      phase: "Idle" as RuntimeSnapshot["sessions"][number]["phase"],
      outputs: [],
      inputs: [],
    })),
    capabilities: [],
    program_switch: null,
    generated_at_ms: 1,
    observation_revision: 1,
    observation_lineage: "test",
  };
}

describe("SessionsPage polling lifecycle (BUG-B regression)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    h.reset();
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  function render(): void {
    act(() => {
      root.render(<SessionsPage />);
    });
  }

  async function settle(): Promise<void> {
    // flush pending microtasks + pending React state cascades without advancing timers
    for (let i = 0; i < 6; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    }
  }

  it("1+2+3. mount=1; state updates cause no storm; 1999ms=1; 2000ms=2; 4000ms=3", async () => {
    h.setSnapshot(makeSnapshot([]));
    render();
    await settle();
    expect(h.runtimeCalls).toBe(1);
    // extra settle cycles must not manufacture requests (storm check)
    await settle();
    await settle();
    expect(h.runtimeCalls).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1999);
    });
    expect(h.runtimeCalls).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(h.runtimeCalls).toBe(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(h.runtimeCalls).toBe(3);
  });

  it("3b. runtime error responses do not change the cadence either", async () => {
    // snapshot null → getRuntime returns error envelope (agent down)
    render();
    await settle();
    expect(h.runtimeCalls).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(h.runtimeCalls).toBe(2);
    expect(container.querySelector(".error-banner")?.textContent).toContain("agent down");
  });

  it("4. command polling (500ms) is independent of the 2s runtime cadence", async () => {
    h.setSnapshot(makeSnapshot([]));
    render();
    await settle();
    expect(h.runtimeCalls).toBe(1);
    expect(h.commandCalls).toBe(0);
    h.commandPendingSteps = 2; // pending → pending → completed
    const input = container.querySelector<HTMLInputElement>("input.credential");
    expect(input).not.toBeNull();
    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      nativeSetter.call(input!, "4fa33dcb-0000-0000-0000-000000000001");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const startBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Start")!;
    await act(async () => {
      startBtn.click();
    });
    expect(h.startCalls).toHaveLength(1);
    // command polled at t≈0 (pending), t≈500 (pending), t≈1000 (completed);
    // runtime cadence untouched (1100 < 2000 → still exactly the mount call).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(h.commandCalls).toBe(3);
    expect(h.runtimeCalls).toBe(1);
    // t=1100 now; the 2s interval fires at absolute t=2000 — command polling
    // (3 calls in 1.1s) did not shift the runtime cadence grid.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(899); // t=1999
    });
    expect(h.runtimeCalls).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1); // t=2000
    });
    expect(h.runtimeCalls).toBe(2);
    // command terminal state displayed honestly
    expect(container.textContent).toContain("completed");
  });

  it("5. Release targets the latest non-terminated session when none is running (canonical idempotent removal); Stop still refuses", async () => {
    // 真实 BMD Runtime 语义（2026-09-29 实证）：stop 对非 running 会话 =
    // failed(permanent) 诚实拒绝；release 对已 released 会话 = 幂等 executed。
    h.setSnapshot(makeSnapshot(["released"]));
    render();
    await settle();
    const buttons = container.querySelectorAll("button");
    const stopBtn = [...buttons].find((b) => b.textContent === "Stop")!;
    const releaseBtn = [...buttons].find((b) => b.textContent === "Release")!;
    await act(async () => {
      stopBtn.click();
    });
    expect(h.stopCalls).toHaveLength(0); // Stop refuses: no running session
    expect(container.textContent).toContain("no active session");
    await act(async () => {
      releaseBtn.click();
    });
    expect(h.releaseCalls).toHaveLength(1); // Release issues the real command
    expect(h.releaseCalls[0]).toBe("sess-1");
    await settle();
    // command journey result displayed honestly (id + terminal state)
    expect(container.textContent).toContain("cmd-rel-1");
    expect(container.textContent).toContain("completed");
  });
});
