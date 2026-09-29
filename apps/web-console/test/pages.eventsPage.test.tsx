// @vitest-environment jsdom
/**
 * EventsPage 页面生命周期 regression（WEB-CONSOLE-BMD-ACCEPTANCE-01 BUG-A）。
 *
 * 机械证明（不受纯 parser 测试覆盖的 React lifecycle 语义）：
 *  1. mount → openEventStream exactly once
 *  2. payload sequence 1 → UI cursor=1，open count 仍为 1
 *  3. payload sequence 2 → open count 仍为 1（正常事件绝不重建连接）
 *  4. disconnect（onError）→ 按 backoff reconnect
 *  5. reconnect 使用 cursor=lastSequence（strictly-after 续传）
 *  6. reconnect 前旧 handle 已 close（单 active transport）
 *  7. duplicate sequence 不重复展示（跨重连）
 *  8. unexpected EOF 语义在 api.sse.test.ts 单测覆盖；页面层以 onError 等价驱动
 *  9. unmount 后无 reconnect timer / 无 active stream
 * 10. reload/new mount 先 canonical snapshot（getRuntime），再增量 stream
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const h = vi.hoisted(() => {
  const order: string[] = [];
  const runtimeCalls: number[] = [];
  let snapshot: { sessions: unknown[]; devices: unknown[] } | null = {
    sessions: [],
    devices: [],
  };
  interface RecordedCall {
    cursor?: number;
    onPayload(payload: { sequence: number; observed_at_ms: number; weak_ordering: true; snapshot: Record<string, unknown> }): void;
    onError(err: Error): void;
  }
  const openCalls: RecordedCall[] = [];
  const handleState: Array<{ closed: boolean; last: number | null }> = [];
  function setSnapshot(s: { sessions: unknown[]; devices: unknown[] } | null): void {
    snapshot = s;
  }
  function reset(): void {
    order.length = 0;
    runtimeCalls.length = 0;
    openCalls.length = 0;
    handleState.length = 0;
    snapshot = { sessions: [], devices: [] };
  }
  return { order, runtimeCalls, openCalls, handleState, setSnapshot, reset, get snapshot() { return snapshot; } };
});

vi.mock("../src/api/sse.ts", () => ({
  openEventStream: (opts: {
    cursor?: number;
    onPayload(payload: { sequence: number; observed_at_ms: number; weak_ordering: true; snapshot: Record<string, unknown> }): void;
    onError(err: Error): void;
  }) => {
    const idx = h.openCalls.length;
    h.openCalls.push(opts);
    h.order.push(`sse:${idx}`);
    h.handleState.push({ closed: false, last: null });
    return {
      close: () => {
        h.handleState[idx]!.closed = true;
      },
      lastSequence: () => h.handleState[idx]!.last,
      get retryHintMs() {
        return 3000;
      },
    };
  },
}));

vi.mock("../src/api/client.ts", () => ({
  getRuntime: async () => {
    h.runtimeCalls.push(h.runtimeCalls.length);
    h.order.push("runtime");
    if (h.snapshot === null) {
      return {
        kind: "error" as const,
        status: 503,
        envelope: { error: { code: "DEPENDENCY_UNAVAILABLE", message: "agent down", request_id: "t", retryable: true } },
      };
    }
    return {
      kind: "ok" as const,
      status: 200,
      body: {
        ...h.snapshot,
        devices: [],
        ports: [],
        resources: [],
        capabilities: [],
        program_switch: null,
        generated_at_ms: 1,
        observation_revision: 1,
        observation_lineage: "test",
      },
    };
  },
}));

import { EventsPage } from "../src/pages/EventsPage.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function framePayload(sequence: number): { sequence: number; observed_at_ms: number; weak_ordering: true; snapshot: Record<string, unknown> } {
  return { sequence, observed_at_ms: 1_700_000_000_000 + sequence, weak_ordering: true, snapshot: { total: sequence } };
}

function eventRowCount(container: HTMLElement): number {
  return container.querySelectorAll(".event-row").length;
}

describe("EventsPage lifecycle (BUG-A regression)", () => {
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
      root.render(<EventsPage />);
    });
  }

  it("1+10. mount opens exactly one SSE, canonical snapshot fetched first", async () => {
    render();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(h.openCalls).toHaveLength(1);
    // canonical runtime snapshot must be fetched before/with the stream start
    expect(h.order).toContain("runtime");
    expect(h.order[0]).toBe("runtime");
  });

  it("2+3. payload sequence 1 then 2 → cursor advances, open count stays 1", async () => {
    render();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    act(() => {
      h.openCalls[0]!.onPayload(framePayload(1));
    });
    act(() => {
      h.openCalls[0]!.onPayload(framePayload(2));
    });
    expect(h.openCalls).toHaveLength(1);
    expect(container.querySelector(".kv")?.textContent).toContain("2");
    expect(eventRowCount(container)).toBe(2);
  });

  it("4+5+6. disconnect → backoff reconnect with cursor=lastSequence; old handle closed first", async () => {
    render();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    act(() => {
      h.openCalls[0]!.onPayload(framePayload(7));
    });
    expect(h.openCalls).toHaveLength(1);
    act(() => {
      h.openCalls[0]!.onError(new Error("connection reset"));
    });
    expect(h.openCalls).toHaveLength(1); // no immediate duplicate stream
    // backoff[0] = 500ms
    await act(async () => {
      await vi.advanceTimersByTimeAsync(499);
    });
    expect(h.openCalls).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(h.openCalls).toHaveLength(2);
    expect(h.openCalls[1]!.cursor).toBe(7);
    expect(h.handleState[0]!.closed).toBe(true);
    expect(h.handleState[1]!.closed).toBe(false);
  });

  it("4b. repeated failures advance the backoff ladder (500 → 1000 → 2000)", async () => {
    render();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    act(() => {
      h.openCalls[0]!.onError(new Error("eof"));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(h.openCalls).toHaveLength(2);
    act(() => {
      h.openCalls[1]!.onError(new Error("eof"));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(h.openCalls).toHaveLength(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(h.openCalls).toHaveLength(3);
    // successful payload resets the ladder
    act(() => {
      h.openCalls[2]!.onPayload(framePayload(30));
    });
    act(() => {
      h.openCalls[2]!.onError(new Error("eof"));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(h.openCalls).toHaveLength(4);
  });

  it("7. duplicate sequence across reconnects is not displayed twice", async () => {
    render();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    act(() => {
      h.openCalls[0]!.onPayload(framePayload(5));
    });
    act(() => {
      h.openCalls[0]!.onError(new Error("reset"));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(h.openCalls).toHaveLength(2);
    // server replays sequence 5 (at-least-once)
    act(() => {
      h.openCalls[1]!.onPayload(framePayload(5));
    });
    act(() => {
      h.openCalls[1]!.onPayload(framePayload(6));
    });
    expect(eventRowCount(container)).toBe(2); // #5 once, #6 once
  });

  it("9. unmount cancels reconnect timers and closes the stream", async () => {
    render();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    act(() => {
      h.openCalls[0]!.onPayload(framePayload(1));
    });
    act(() => {
      h.openCalls[0]!.onError(new Error("reset"));
    });
    act(() => {
      root.unmount();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(h.openCalls).toHaveLength(1); // no reconnect after unmount
    expect(h.handleState[0]!.closed).toBe(true);
  });

  it("10b. snapshot failure is surfaced, stream still starts (increment still allowed)", async () => {
    h.setSnapshot(null);
    render();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(h.openCalls).toHaveLength(1);
    expect(container.querySelector(".error-banner")?.textContent).toContain("/api/v1/runtime");
  });
});
