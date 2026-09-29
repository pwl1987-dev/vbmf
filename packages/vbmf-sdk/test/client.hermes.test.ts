/**
 * SDK-01B/01C hermetic 测试（fake fetch；无网络、无 Fastify）。
 *
 * 覆盖（planning 验证矩阵）：
 * - happy path 200 → typed 返回；
 * - 4xx/5xx envelope → VbmfApiError（status/envelope/request_id/retryable）；
 * - 429 + Retry-After → retryAfterMs；
 * - 网络失败 → status 0 + DEPENDENCY_UNAVAILABLE（同 envelope 形态）；
 * - 非 JSON 响应 → INTERNAL_ERROR 合成；
 * - credential provider 每请求调用（rotation 面）；
 * - idempotency key 必填 + 头透传；
 * - AbortSignal 透传；
 * - 禁 catch→null/false：一切失败都抛 VbmfApiError。
 */
import { describe, expect, it, vi } from "vitest";
import { VbmfClient, VbmfApiError, type StartSessionBody } from "../src/index.ts";

async function expectApiError(p: Promise<unknown>): Promise<VbmfApiError> {
  try {
    await p;
  } catch (e) {
    return e as VbmfApiError;
  }
  throw new Error("expected VbmfApiError, got success (errors must never be swallowed)");
}


function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

const envelope = (code: string, retryable: boolean) => ({
  error: { code, message: `msg ${code}`, request_id: "req-1", retryable },
});

function makeClient(fetchImpl: typeof fetch, provider = vi.fn(() => "k-test")): VbmfClient {
  return new VbmfClient({ baseUrl: "https://vbmf.test", credentialProvider: provider, fetchImpl });
}

describe("VbmfClient core (hermetic)", () => {
  it("getRuntime 200 → typed snapshot", async () => {
    const snap = {
      devices: [], ports: [], resources: [], sessions: [],
      capabilities: [], program_switch: null,
      generated_at_ms: 1, observation_revision: 2, observation_lineage: "x",
    };
    const c = makeClient((async () => jsonResponse(200, snap)) as typeof fetch);
    const out = await c.getRuntime();
    expect(out.observation_revision).toBe(2);
  });

  it("getRuntime(sessionId) encodes the query param", async () => {
    let captured = "";
    const c = makeClient((async (input: RequestInfo | URL) => {
      captured = String(input);
      return jsonResponse(200, {});
    }) as typeof fetch);
    await c.getRuntime("00000000-0000-0000-0000-0000000000ab");
    expect(captured).toContain("/api/v1/runtime?session_id=00000000-0000-0000-0000-0000000000ab");
  });

  it("401 envelope → VbmfApiError with status/envelope/requestId/retryable", async () => {
    const c = makeClient((async () => jsonResponse(401, envelope("AUTHENTICATION_FAILED", false))) as typeof fetch);
    const err = await expectApiError(c.healthLive());
    expect(err).toBeInstanceOf(VbmfApiError);
    expect(err.status).toBe(401);
    expect(err.code).toBe("AUTHENTICATION_FAILED");
    expect(err.requestId).toBe("req-1");
    expect(err.retryable).toBe(false);
  });

  it("429 + Retry-After → retryAfterMs parsed", async () => {
    const c = makeClient((async () =>
      jsonResponse(429, envelope("RATE_LIMITED", true), { "retry-after": "3" })) as typeof fetch);
    const err = await expectApiError(c.getRuntime());
    expect(err.status).toBe(429);
    expect(err.retryAfterMs).toBe(3000);
    expect(err.retryable).toBe(true);
  });

  it("network failure → status 0 + DEPENDENCY_UNAVAILABLE synthesized envelope", async () => {
    const c = makeClient((async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch);
    const err = await expectApiError(c.health());
    expect(err.status).toBe(0);
    expect(err.code).toBe("DEPENDENCY_UNAVAILABLE");
    expect(err.retryable).toBe(true);
  });

  it("non-JSON 502 body → INTERNAL_ERROR synthesized (never success/null)", async () => {
    const c = makeClient((async () =>
      new Response("<html>bad gateway</html>", { status: 502, headers: { "content-type": "text/html" } })) as typeof fetch);
    const err = await expectApiError(c.getCommand("cmd-1"));
    expect(err.status).toBe(502);
    expect(err.code).toBe("INTERNAL_ERROR");
  });

  it("credential provider is invoked per request (rotation surface)", async () => {
    const provider = vi.fn(() => "k-1");
    let header1 = "";
    let header2 = "";
    let call = 0;
    const c = makeClient((async (_input: RequestInfo | URL, init?: RequestInit) => {
      call += 1;
      const h = (init?.headers as Record<string, string>);
      if (call === 1) header1 = h["x-api-key"] ?? "";
      else header2 = h["x-api-key"] ?? "";
      return jsonResponse(200, { status: "live" });
    }) as unknown as typeof fetch, provider);
    await c.healthLive();
    provider.mockReturnValue("k-2");
    await c.healthLive();
    expect(header1).toBe("k-1");
    expect(header2).toBe("k-2");
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it("startSession: idempotency-key header + canonical body passthrough; empty key rejected", async () => {
    let capturedInit: RequestInit | undefined;
    let capturedUrl = "";
    const c = makeClient((async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedInit = init;
      return jsonResponse(200, { command_id: "00000000-0000-0000-0000-0000000000aa", state: "completed", kind: "start_session", created_at: "t" });
    }) as typeof fetch);
    const intent: StartSessionBody["intent"] = {
      version: "1.0",
      devices: [{
        device_id: "00000000-0000-0000-0000-0000000000d1",
        role: "CAPTURE",
        pipeline: { source: { kind: "decklink", device_id: "00000000-0000-0000-0000-0000000000d1" }, sink: { kind: "appsink" } },
      }],
    };
    const res = await c.startSession({ intent }, "idem-1");
    expect(res.state).toBe("completed");
    expect(capturedUrl).toBe("https://vbmf.test/api/v1/sessions");
    expect((capturedInit!.headers as Record<string, string>)["idempotency-key"]).toBe("idem-1");
    expect(JSON.parse(String(capturedInit!.body)).intent.devices[0].pipeline.sink.kind).toBe("appsink");
    await expect(c.stopSession("00000000-0000-0000-0000-0000000000ab", "")).rejects.toThrow(/idempotencyKey/);
  });

  it("AbortSignal is passed through to fetch", async () => {
    let sawSignal = false;
    const c = makeClient((async (_i: RequestInfo | URL, init?: RequestInit) => {
      sawSignal = init?.signal instanceof AbortSignal;
      return jsonResponse(200, { status: "live" });
    }) as unknown as typeof fetch);
    await c.healthLive(new AbortController().signal);
    expect(sawSignal).toBe(true);
  });

  it("session path segments are URL-encoded (path injection guard)", async () => {
    let captured = "";
    const c = makeClient((async (input: RequestInfo | URL) => {
      captured = String(input);
      return jsonResponse(200, { command_id: "x", state: "completed", kind: "stop_session", created_at: "t" });
    }) as typeof fetch);
    await c.stopSession("a/b?c=d", "idem-2");
    expect(captured).toContain("/api/v1/sessions/a%2Fb%3Fc%3Dd/stop");
  });
});

describe("VbmfClient alarms (HI-01C hermetic)", () => {
  const alarmItem = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: "11111111-1111-1111-1111-111111111111",
    fingerprint: "pipeline_fault:pipeline:33333333-3333-3333-3333-333333333333",
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
  });

  it("listAlarms 200 → typed list + query 编码", async () => {
    let calledUrl = "";
    const c = makeClient((async (input: RequestInfo | URL) => {
      calledUrl = String(input);
      return jsonResponse(200, { alarms: [alarmItem()], count: 1 });
    }) as typeof fetch);
    const out = await c.listAlarms({ active: true, severity: "error", limit: 25 });
    expect(out.count).toBe(1);
    expect(out.alarms[0]!.kind).toBe("pipeline_fault");
    expect(calledUrl).toContain("/api/v1/alarms?active=true&severity=error&limit=25");
  });

  it("listAlarms 无过滤 → 无 query string", async () => {
    let calledUrl = "";
    const c = makeClient((async (input: RequestInfo | URL) => {
      calledUrl = String(input);
      return jsonResponse(200, { alarms: [], count: 0 });
    }) as typeof fetch);
    await c.listAlarms();
    expect(calledUrl.endsWith("/api/v1/alarms")).toBe(true);
  });

  it("getAlarm 404 → VbmfApiError RESOURCE_NOT_FOUND（不吞错误）", async () => {
    const c = makeClient((async () => jsonResponse(404, envelope("RESOURCE_NOT_FOUND", false))) as typeof fetch);
    const err = await expectApiError(c.getAlarm("11111111-1111-1111-1111-111111111111"));
    expect(err.status).toBe(404);
    expect(err.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("ackAlarm POST + note body → acked item（awareness only 字段如实）", async () => {
    let method = "";
    let body: unknown = undefined;
    const c = makeClient((async (_input: RequestInfo | URL, init?: RequestInit) => {
      method = init?.method ?? "GET";
      body = init?.body;
      return jsonResponse(200, alarmItem({ ack_by: "user-1", ack_note: "seen", ack_at: "2026-09-29T01:00:00.000Z", active: true }));
    }) as typeof fetch);
    const out = await c.ackAlarm("11111111-1111-1111-1111-111111111111", "seen");
    expect(method).toBe("POST");
    expect(JSON.parse(String(body))).toEqual({ note: "seen" });
    expect(out.ack_by).toBe("user-1");
    expect(out.active).toBe(true);
  });
});
