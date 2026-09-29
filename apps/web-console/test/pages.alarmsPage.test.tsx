// @vitest-environment jsdom
/**
 * HI-01D — AlarmsPage 旅程测试。
 *
 * 红线机械证明：
 * 1. 数据全部来自 /api/v1/alarms canonical 面（无本地 alarm 伪造）；
 * 2. active alarm 渲染 severity/kind/related/recovery/state；
 * 3. Ack 按钮 → POST ack → 刷新后 ack 状态显示，而 alarm 仍 ACTIVE
 *    （acknowledged ≠ healthy——UI 不因 ACK 掩盖真实状态）；
 * 4. cleared history 折叠展示；
 * 5. API 错误真实展示（不吞）。
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { setTestFetchImpl } from "../src/api/client.ts";
import { AlarmsPage } from "../src/pages/AlarmsPage.tsx";

const A_ID = "11111111-1111-1111-1111-111111111111";

function alarmItem(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: A_ID,
    fingerprint: `pipeline_fault:pipeline:33333333-3333-3333-3333-333333333333`,
    severity: "warning",
    kind: "pipeline_fault",
    failure_domain: "pipeline",
    related_session_id: null,
    related_device_id: null,
    related_pipeline_id: "33333333-3333-3333-3333-333333333333",
    summary: "bus error",
    retryable: true,
    recovery_status: "active",
    first_seen_at: "2026-09-29T00:00:00.000Z",
    last_seen_at: "2026-09-29T00:00:01.000Z",
    event_count: 1,
    active: true,
    cleared_at: null,
    clear_reason: null,
    ack_at: null,
    ack_by: null,
    ack_note: null,
    ...over,
  };
}

interface Call {
  method: string;
  url: string;
  body?: unknown;
}

function makeFetch(routes: {
  active: Record<string, unknown>[];
  history?: Record<string, unknown>[];
  ackResponse?: Record<string, unknown>;
  error?: { status: number; code: string; message: string };
}): { impl: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    calls.push({ method: init?.method ?? "GET", url, body: init?.body });
    if (url.includes("/api/v1/alarms") && url.endsWith("/ack")) {
      const body = routes.ackResponse ?? alarmItem({ ack_at: "2026-09-29T01:00:00.000Z", ack_by: "u1", ack_note: "acknowledged from web console" });
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("active=true")) {
      if (routes.error !== undefined) {
        return new Response(
          JSON.stringify({ error: { code: routes.error.code, message: routes.error.message, request_id: "r1", retryable: false } }),
          { status: routes.error.status, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ alarms: routes.active, count: routes.active.length }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("active=false")) {
      return new Response(JSON.stringify({ alarms: routes.history ?? [], count: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
  return { impl, calls };
}

async function renderPage(): Promise<{ root: Root; container: HTMLElement }> {
  const container = document.createElement("div");
  document.body.replaceChildren(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<AlarmsPage />);
  });
  return { root, container };
}

describe("AlarmsPage (HI-01D)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("active alarm 渲染 canonical 字段 + 无本地伪造（数据仅经 /api/v1/alarms）", async () => {
    const { impl, calls } = makeFetch({ active: [alarmItem()] });
    setTestFetchImpl(impl);
    const { container } = await renderPage();
    const text = container.textContent ?? "";
    expect(text).toContain("pipeline_fault");
    expect(text).toContain("bus error");
    expect(text).toContain("ACTIVE");
    expect(calls.every((c) => c.url.startsWith("/api/v1/alarms") || c.url.includes("/api/v1/alarms"))).toBe(true);
    setTestFetchImpl(null);
  });

  it("Ack 旅程：POST → 刷新后 acked 且 alarm 仍 ACTIVE（acknowledged ≠ healthy）", async () => {
    let acked = false;
    const makeRoutes = () => ({
      active: [alarmItem(acked
        ? { ack_at: "2026-09-29T01:00:00.000Z", ack_by: "u1", ack_note: "acknowledged from web console" }
        : {})],
    });
    let { impl } = makeFetch(makeRoutes());
    // 动态刷新：ack 后 active 列表带 ack 字段。
    impl = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (url.endsWith("/ack")) {
        acked = true;
        return new Response(JSON.stringify(alarmItem({ ack_at: "2026-09-29T01:00:00.000Z", ack_by: "u1" })), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      const routes = makeRoutes();
      const r = makeFetch(routes);
      return (r.impl as unknown as (i: RequestInfo | URL, o?: RequestInit) => Promise<Response>)(input, init);
    }) as typeof fetch;
    setTestFetchImpl(impl);
    const { container } = await renderPage();

    const btn = container.querySelector("button");
    expect(btn).not.toBeNull();
    await act(async () => {
      btn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const text = container.textContent ?? "";
    expect(text).toContain("acked");
    expect(text).toContain("ACTIVE");
    setTestFetchImpl(null);
  });

  it("cleared history 折叠展示 + API 错误真实展示", async () => {
    const { impl } = makeFetch({
      active: [],
      history: [alarmItem({ active: false, clear_reason: "recovered", recovery_status: "recovered" })],
    });
    setTestFetchImpl(impl);
    const { container } = await renderPage();
    const text = container.textContent ?? "";
    expect(text).toContain("No active alarms");
    expect(text).toContain("Cleared history");
    setTestFetchImpl(null);

    // 错误面
    const errFetch = makeFetch({ active: [], error: { status: 503, code: "RESOURCE_UNAVAILABLE", message: "not configured" } });
    setTestFetchImpl(errFetch.impl);
    const errPage = await renderPage();
    expect(errPage.container.textContent ?? "").toContain("RESOURCE_UNAVAILABLE");
    setTestFetchImpl(null);
  });
});
