// @vitest-environment jsdom
/**
 * DashboardPage（WCO-01B · 01-dashboard LOCK 表面 MVP 映射）机械证明：
 *  - 默认 zh-CN 渲染（新表面落地页中文）+ N/A 格诚实呈现 + 真 PGM 设备名；
 *  - 监看流 = 同源 /hls/index.m3u8（hls.js 引擎），unmount 必 destroy；
 *  - start 旅程 intent.devices[0].pipeline.sink.kind === "hls"，轮询到 completed；
 *  - stop 旅程 observed≠desired 时显式 DIVERGENT（不假装成功）。
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { RuntimeSnapshot } from "../src/api/schemas.ts";

const h = vi.hoisted(() => {
  const instances: Array<Record<string, unknown>> = [];
  const startCalls: unknown[] = [];
  const stopCalls: string[] = [];
  const alarms: unknown[] = [];
  let runtime: unknown = null;
  let commandSteps = 0;
  let calls = 0;
  return {
    instances,
    startCalls,
    stopCalls,
    alarms,
    setRuntime(r: unknown): void { runtime = r; },
    get runtime() { return runtime; },
    setCommandSteps(n: number): void { commandSteps = n; calls = 0; },
    nextCommand(id: string): unknown {
      calls += 1;
      const state = calls <= commandSteps ? "pending" : "completed";
      return {
        command_id: id,
        state,
        kind: "start_session",
        created_at: "2026-11-27T00:00:00.000Z",
        ...(state === "completed" ? { terminal_at: "2026-11-27T00:00:01.000Z" } : {}),
      };
    },
    reset(): void {
      instances.length = 0;
      startCalls.length = 0;
      stopCalls.length = 0;
      alarms.length = 0;
      runtime = null;
      commandSteps = 0;
      calls = 0;
    },
  };
});

vi.mock("hls.js", () => ({
  default: class FakeHls {
    static isSupported(): boolean { return true; }
    loaded: string | null = null;
    media: unknown = null;
    destroyed = false;
    constructor(_cfg: unknown) { h.instances.push(this as unknown as Record<string, unknown>); }
    loadSource(url: string): void { this.loaded = url; }
    attachMedia(el: unknown): void { this.media = el; }
    destroy(): void { this.destroyed = true; }
  },
}));

vi.mock("../src/api/client.ts", () => ({
  ApiClientError: class ApiClientError extends Error {},
  getRuntime: async () =>
    h.runtime === null
      ? { kind: "error", status: 503, envelope: { error: { code: "DEPENDENCY_UNAVAILABLE", message: "agent down", request_id: "t", retryable: true } } }
      : { kind: "ok", status: 200, body: h.runtime },
  getAlarms: async () => ({ kind: "ok", status: 200, body: { alarms: h.alarms, count: h.alarms.length } }),
  postStartSession: async (body: unknown) => {
    h.startCalls.push(body);
    return { kind: "ok", status: 200, body: { command_id: "cmd-start-1", state: "pending", kind: "start_session", created_at: "2026-11-27T00:00:00.000Z" } };
  },
  postStopSession: async (sid: string) => {
    h.stopCalls.push(sid);
    return { kind: "ok", status: 200, body: { command_id: "cmd-stop-1", state: "completed", kind: "stop_session", created_at: "2026-11-27T00:00:00.000Z", terminal_at: "2026-11-27T00:00:01.000Z" } };
  },
  getCommand: async (id: string) => ({ kind: "ok", status: 200, body: h.nextCommand(id) }),
}));

import { DashboardPage } from "../src/pages/DashboardPage.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DEV1 = "4fa33dcb-5f76-5f76-aea8-330df7ada03e";
const DEV2 = "6ede00d0-baf4-573f-a0dd-4a503bf7f766";

function snapshot(running: boolean): RuntimeSnapshot {
  return {
    devices: [
      { id: DEV1, model: "DeckLink SDI" },
      { id: DEV2, model: "DeckLink SDI" },
    ],
    ports: [
      { id: "p1", device_id: DEV1, direction: "input" },
      { id: "p2", device_id: DEV2, direction: "input" },
    ],
    resources: running ? [{ id: "r1", device_id: DEV1, state: "allocated" }] : [],
    sessions: running
      ? [{ id: "sess-1", state: "running", phase: "running", outputs: [], inputs: [{ id: DEV1, handle: 1 }] }]
      : [],
    capabilities: [],
    program_switch: running ? { session_id: "sess-1", observed_active: DEV1 } : null,
    generated_at_ms: 1788684974022,
    observation_revision: 11,
    observation_lineage: "25ffdcea-5305-47e7-bc12-01d1772eb624",
  } as unknown as RuntimeSnapshot;
}

const ACTIVE_ALARM = {
  id: "a1", fingerprint: "fp", severity: "warning", kind: "capture_signal_lost",
  failure_domain: "ingest", related_session_id: null, related_device_id: DEV1,
  related_pipeline_id: null, summary: "signal lost on IN-1", retryable: null,
  recovery_status: "active", first_seen_at: "2026-11-27T00:00:00Z", last_seen_at: "2026-11-27T00:00:00Z",
  event_count: 1, active: true, cleared_at: null, clear_reason: null,
  ack_at: null, ack_by: null, ack_note: null,
};

describe("DashboardPage (WCO-01B 01-dashboard)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let unmounted = false;

  beforeEach(() => {
    h.reset();
    unmounted = false;
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (!unmounted) {
      act(() => { root.unmount(); });
    }
    container.remove();
    vi.useRealTimers();
  });

  function render(): void {
    act(() => { root.render(<DashboardPage />); });
  }

  async function settle(): Promise<void> {
    for (let i = 0; i < 4; i += 1) {
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    }
  }

  function btn(text: string): HTMLButtonElement {
    const b = [...container.querySelectorAll("button")].find((x) => x.textContent === text);
    if (b === undefined) throw new Error(`button not found: ${text}`);
    return b as HTMLButtonElement;
  }

  it("zh-CN 默认渲染：N/A 诚实 + 真 PGM 设备 + ON AIR + 告警表", async () => {
    h.setRuntime(snapshot(true));
    h.alarms.push(ACTIVE_ALARM);
    render();
    await settle();
    expect(container.textContent).toContain("NOW 当前在播");
    expect(container.textContent).toContain("● ON AIR 直播中");
    expect(container.textContent).toContain("事件 Incidents");
    expect(container.textContent).toContain("capture_signal_lost");
    expect(container.textContent).toContain("DeckLink SDI");
    expect((container.textContent ?? "").match(/N\/A/g)?.length).toBe(4);
    expect(btn("▶ 启动 HLS 监看").disabled).toBe(true);
    expect(btn("■ 停止监看").disabled).toBe(false);
  });

  it("监看窗经 hls.js 播同源 /hls/index.m3u8；unmount 即 destroy", async () => {
    h.setRuntime(snapshot(true));
    render();
    await settle();
    expect(h.instances.length).toBe(1);
    expect(h.instances[0]?.["loaded"]).toBe("/hls/index.m3u8");
    expect(h.instances[0]?.["media"]).not.toBeNull();
    act(() => { root.unmount(); });
    unmounted = true;
    expect(h.instances[0]?.["destroyed"]).toBe(true);
  });

  it("start 旅程：sink.kind=hls 落空闲输入设备，轮询到 completed", async () => {
    h.setRuntime(snapshot(false));
    h.setCommandSteps(2);
    render();
    await settle();
    expect(h.instances.length).toBe(0);
    expect(btn("■ 停止监看").disabled).toBe(true);
    await act(async () => {
      btn("▶ 启动 HLS 监看").click();
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(h.startCalls.length).toBe(1);
    const body = h.startCalls[0] as { intent: { devices: Array<{ device_id: string; pipeline: { sink: { kind: string } } }> } };
    expect(body.intent.devices[0]?.device_id).toBe(DEV1);
    expect(body.intent.devices[0]?.pipeline.sink.kind).toBe("hls");
    expect(container.textContent).toContain("cmd-start-1");
    expect(container.textContent).toContain("completed");
  });

  it("stop 旅程：observed≠desired 时显式 DIVERGENT（不假装成功）", async () => {
    h.setRuntime(snapshot(true));
    render();
    await settle();
    await act(async () => {
      btn("■ 停止监看").click();
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(h.stopCalls).toEqual(["sess-1"]);
    // mock runtime 仍报 running（desired=Stopped）→ 必须诚实提示 divergence
    expect(container.textContent).toContain("DIVERGENT");
  });
});
