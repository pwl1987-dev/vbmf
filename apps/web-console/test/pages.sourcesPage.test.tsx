// @vitest-environment jsdom
/**
 * SourcesPage（WCO-01C · 02-sources LOCK 表面 MVP 映射）机械证明：
 *  - 默认 zh-CN；真快照 3 设备行 + binding 抽取 + 占用/空闲 + Used By（会话 id8·state）；
 *  - V0.2 无观测列（connector/format/lock/qc × 3 行 + monitor binding 缺失）= N/A 计数精确 13；
 *  - Network tab 空态（不放假成功）；Add Source 禁用（清单 systemd/env 权威）。
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const h = vi.hoisted(() => {
  let runtime: unknown = null;
  return {
    setRuntime(r: unknown): void { runtime = r; },
    reset(): void { runtime = null; },
    get runtime() { return runtime; },
  };
});

vi.mock("../src/api/client.ts", () => ({
  ApiClientError: class ApiClientError extends Error {},
  getRuntime: async () =>
    h.runtime === null
      ? { kind: "error", status: 503, envelope: { error: { code: "DEPENDENCY_UNAVAILABLE", message: "agent down", request_id: "t", retryable: true } } }
      : { kind: "ok", status: 200, body: h.runtime },
}));

import { SourcesPage } from "../src/pages/SourcesPage.tsx";
import { setLocale } from "../src/i18n/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// 真机形状（2026-11-27 BMD /api/v1/runtime 快照裁剪）
const SDI1 = "4fa33dcb-5f76-5f76-aea8-330df7ada03e";
const SDI2 = "6ede00d0-baf4-573f-a0dd-4a503bf7f766";
const MON = "1afe2dcc-6d85-5b46-b7d6-e14102501c77";
const BIND = "bindingstatus { match_kind: devicehandleexact, confidence: high }";
const snapshot = {
  devices: [
    { id: SDI1, model: "DeckLink SDI", binding: BIND, capabilities: null },
    { id: SDI2, model: "DeckLink SDI", binding: BIND, capabilities: null },
    { id: MON, model: "DeckLink Mini Monitor 4K", binding: null, capabilities: null },
  ],
  ports: [
    { id: "p1", device_id: SDI1, direction: "input" },
    { id: "p2", device_id: SDI2, direction: "input" },
    { id: "p3", device_id: MON, direction: "output" },
  ],
  resources: [
    { id: "r1", device_id: SDI1, state: "allocated" },
    { id: "r2", device_id: SDI2, state: "available" },
    { id: "r3", device_id: MON, state: "available" },
  ],
  sessions: [
    { id: "6c659606-4472-44e3-8630-e27520c8ae41", label: "s1", state: "running", phase: "running", outputs: ["hls"], inputs: [{ handle: 2, id: SDI1 }] },
  ],
  capabilities: [],
  program_switch: { observed_active: SDI1 },
  generated_at_ms: 1764225500000,
  observation_revision: 42,
  observation_lineage: "l",
};

describe("SourcesPage (WCO-01C)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    h.reset();
    setLocale("zh-CN");
    container = document.createElement("div");
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  function render(): void {
    act(() => { root.render(<SourcesPage />); });
  }

  async function settle(): Promise<void> {
    for (let i = 0; i < 4; i += 1) {
      await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    }
  }

  it("本地表按真快照渲染 + Used By 指到 running 会话 + N/A 计数精确", async () => {
    h.setRuntime(snapshot);
    render();
    await settle();
    const text = container.textContent ?? "";
    expect(text).toContain("DeckLink Mini Monitor 4K");
    expect(text).toContain("devicehandleexact · high");
    expect(text).toContain("占用");
    expect(text).toContain("空闲");
    expect(text).toContain("6c659606(running)");
    // connector/format/lock/qc 4 列 × 3 行 + monitor binding 缺失 = 13 个显式 N/A
    expect((text.match(/N\/A/g) ?? []).length).toBe(13);
  });

  it("Network tab 空态（无假成功），切回本地表恢复", async () => {
    h.setRuntime(snapshot);
    render();
    await settle();
    const btns = Array.from(container.querySelectorAll<HTMLButtonElement>(".src-tabs button"));
    await act(async () => { btns[1]?.click(); });
    expect(container.textContent ?? "").toContain("E-40");
    expect(container.querySelector("table")).toBeNull();
    await act(async () => { btns[0]?.click(); });
    expect(container.querySelector("table")).not.toBeNull();
  });

  it("Add Source 禁用（device-binding 清单 systemd/env 权威）", async () => {
    h.setRuntime(snapshot);
    render();
    await settle();
    const btn = container.querySelector(".dash-panel button") as HTMLButtonElement | null;
    expect(btn?.disabled).toBe(true);
  });

  it("output 设备 Used By 为破折号（仅 inputs 真引用才显示）", async () => {
    h.setRuntime(snapshot);
    render();
    await settle();
    const rows = Array.from(container.querySelectorAll("tbody tr"));
    const monRow = rows.find((r) => (r.textContent ?? "").includes("Mini Monitor"));
    expect(monRow?.textContent ?? "").toContain("—");
  });
});
