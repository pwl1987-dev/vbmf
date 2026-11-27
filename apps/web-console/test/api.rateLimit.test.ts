/**
 * 多设备同时访问的限流防护（CP-01C · §3.125）。
 *
 * 契约：
 * - 429 ⇒ 读 retry-after（apiFetch 走响应头；SDK 路径走 VbmfApiError.retryAfterMs）→ 进入冷却；
 * - 冷却期内轮询守卫跳过请求（越限不越刷），到期自动恢复；
 * - 页面不可见时不轮询（多标签页只有可见的那页在发请求）。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

const RATE_LIMITED = {
  error: { code: "RATE_LIMITED", message: "slow down", request_id: "r-429", retryable: true },
};

function resp429(retryAfter: string | null): Response {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (retryAfter !== null) headers["retry-after"] = retryAfter;
  return new Response(JSON.stringify(RATE_LIMITED), { status: 429, headers });
}

describe("rate limit cooldown", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-11-27T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("apiFetch 429 with retry-after header enters cooldown", async () => {
    const { apiFetch } = await import("../src/api/client.ts");
    const { rateLimitCooldownMs } = await import("../src/api/rateLimit.ts");
    const fetchImpl = (async () => resp429("5")) as typeof fetch;
    const r = await apiFetch("/api/v1/runtime", { fetchImpl });
    expect(r.kind).toBe("error");
    expect(rateLimitCooldownMs()).toBe(5000);
  });

  it("apiFetch 429 without retry-after falls back to 1s cooldown", async () => {
    const { apiFetch } = await import("../src/api/client.ts");
    const { rateLimitCooldownMs } = await import("../src/api/rateLimit.ts");
    const fetchImpl = (async () => resp429(null)) as typeof fetch;
    await apiFetch("/api/v1/runtime", { fetchImpl });
    expect(rateLimitCooldownMs()).toBe(1000);
  });

  it("SDK path (getRuntime) 429 uses VbmfApiError.retryAfterMs", async () => {
    const { setApiKey } = await import("../src/auth/credentials.ts");
    setApiKey("vbmf_test");
    const { setTestFetchImpl, getRuntime } = await import("../src/api/client.ts");
    const { rateLimitCooldownMs } = await import("../src/api/rateLimit.ts");
    setTestFetchImpl((async () => resp429("3")) as typeof fetch);
    const r = await getRuntime();
    expect(r.kind).toBe("error");
    expect(rateLimitCooldownMs()).toBe(3000);
  });

  it("cooldown expires on its own", async () => {
    const { apiFetch } = await import("../src/api/client.ts");
    const { rateLimitCooldownMs } = await import("../src/api/rateLimit.ts");
    const fetchImpl = (async () => resp429("5")) as typeof fetch;
    await apiFetch("/api/v1/runtime", { fetchImpl });
    expect(rateLimitCooldownMs()).toBe(5000);
    vi.setSystemTime(new Date("2026-11-27T00:00:04Z"));
    expect(rateLimitCooldownMs()).toBe(1000);
    vi.setSystemTime(new Date("2026-11-27T00:00:06Z"));
    expect(rateLimitCooldownMs()).toBe(0);
  });

  it("poll guard skips while cooling down", async () => {
    const { apiFetch } = await import("../src/api/client.ts");
    const { shouldSkipPoll } = await import("../src/api/poll.ts");
    const fetchImpl = (async () => resp429("5")) as typeof fetch;
    await apiFetch("/api/v1/runtime", { fetchImpl });
    expect(shouldSkipPoll()).toBe(true);
  });

  it("poll guard skips hidden pages and passes when visible and idle", async () => {
    const { shouldSkipPoll } = await import("../src/api/poll.ts");
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    expect(shouldSkipPoll()).toBe(true);
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    expect(shouldSkipPoll()).toBe(false);
  });
});
