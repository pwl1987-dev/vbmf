/**
 * Error envelope mapping tests (WCE-01F)。
 * 覆盖：HTTP 401/403/429/503/4xx/5xx → typed ApiResult error 分支；
 * 直接媒体代理路径（:50051、/internal/、media-agent）被 client 静态机检拒绝。
 */
import { describe, expect, it, beforeEach } from "vitest";
import { apiFetch, ApiClientError, apiCall } from "../src/api/client.ts";
import { setApiKey } from "../src/auth/credentials.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  setApiKey("vbmf_test");
});

describe("apiFetch error envelope mapping", () => {
  it("returns ok kind on 2xx", async () => {
    const fetchImpl = (async () => jsonResponse({ ok: true })) as typeof fetch;
    const r = await apiFetch<{ ok: boolean }>("/api/v1/runtime", { fetchImpl });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.status).toBe(200);
      expect(r.body.ok).toBe(true);
    }
  });

  it("returns error kind on 401 with envelope", async () => {
    const envelope = {
      error: {
        code: "AUTHENTICATION_FAILED",
        message: "auth required",
        request_id: "r-1",
        retryable: false,
      },
    };
    const fetchImpl = (async () => jsonResponse(envelope, 401)) as typeof fetch;
    const r = await apiFetch("/api/v1/runtime", { fetchImpl });
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      expect(r.status).toBe(401);
      expect(r.envelope.error.code).toBe("AUTHENTICATION_FAILED");
    }
  });

  it("returns error kind on 429 with retryable=true", async () => {
    const envelope = {
      error: {
        code: "RATE_LIMITED",
        message: "slow down",
        request_id: "r-2",
        retryable: true,
      },
    };
    const fetchImpl = (async () => jsonResponse(envelope, 429)) as typeof fetch;
    const r = await apiFetch("/api/v1/runtime", { fetchImpl });
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      expect(r.status).toBe(429);
      expect(r.envelope.error.retryable).toBe(true);
    }
  });

  it("returns error kind on 503 DEPENDENCY_UNAVAILABLE", async () => {
    const envelope = {
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "agent down",
        request_id: "r-3",
        retryable: true,
      },
    };
    const fetchImpl = (async () => jsonResponse(envelope, 503)) as typeof fetch;
    const r = await apiFetch("/api/v1/runtime", { fetchImpl });
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      expect(r.envelope.error.code).toBe("DEPENDENCY_UNAVAILABLE");
    }
  });

  it("returns synthesized envelope on network failure", async () => {
    const fetchImpl = (async () => {
      throw new TypeError("network unreachable");
    }) as unknown as typeof fetch;
    const r = await apiFetch("/api/v1/runtime", { fetchImpl });
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      expect(r.envelope.error.code).toBe("DEPENDENCY_UNAVAILABLE");
      expect(r.envelope.error.retryable).toBe(true);
    }
  });

  it("returns synthesized INTERNAL_ERROR envelope on non-JSON body", async () => {
    const fetchImpl = (async () =>
      new Response("not json at all", { status: 502, headers: { "content-type": "text/plain" } })) as typeof fetch;
    const r = await apiFetch("/api/v1/runtime", { fetchImpl });
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      expect(r.status).toBe(502);
      expect(r.envelope.error.code).toBe("INTERNAL_ERROR");
    }
  });

  it("rejects non-same-origin URL paths", async () => {
    await expect(
      apiFetch("https://other-host.example.com/api/v1/runtime"),
    ).rejects.toThrow(/same-origin/);
  });

  it("rejects paths that reference :50051 or /internal/", async () => {
    await expect(apiFetch("/internal/v1/agent")).rejects.toThrow(/red line/);
    await expect(apiFetch("/api/redirect-to-:50051")).rejects.toThrow(/red line/);
  });

  it("apiCall throws ApiClientError on non-2xx", async () => {
    const envelope = {
      error: {
        code: "INTERNAL_ERROR",
        message: "boom",
        request_id: "r-9",
        retryable: false,
      },
    };
    const fetchImpl = (async () => jsonResponse(envelope, 500)) as typeof fetch;
    await expect(apiCall("/api/v1/runtime", { fetchImpl })).rejects.toBeInstanceOf(ApiClientError);
  });

  it("apiCall returns body on 2xx", async () => {
    const fetchImpl = (async () => jsonResponse({ ok: 1 })) as typeof fetch;
    const body = await apiCall<{ ok: number }>("/api/v1/runtime", { fetchImpl });
    expect(body.ok).toBe(1);
  });
});
