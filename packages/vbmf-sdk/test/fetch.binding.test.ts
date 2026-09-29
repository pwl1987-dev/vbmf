/**
 * SDK-01D BMD regression 发现的 BUG-H 锁定：默认 fetch 必须 bound。
 *
 * 真浏览器（Playwright Chromium → BMD dogfood 栈）中，SDK 默认路径
 * `globalThis.fetch` 的未绑定引用在调用时抛
 * "Failed to execute 'fetch' on 'Window': Illegal invocation" —— 浏览器
 * fetch 要求 this 为 Window。Node 环境的注入测试路径掩盖了该缺陷。
 * 本测试用一个 this 敏感的 fetch 替身模拟浏览器严格语义。
 */
import { describe, expect, it } from "vitest";
import { VbmfClient } from "../src/client.ts";
import { VbmfEventClient } from "../src/events.ts";

describe("default fetch binding (browser Illegal invocation guard)", () => {
  it("VbmfClient default fetch is bound (this=globalThis)", async () => {
    const orig = globalThis.fetch;
    let illegal = false;
    globalThis.fetch = function (this: unknown, _input: RequestInfo | URL, _init?: RequestInit) {
      if (this == null) {
        illegal = true;
        throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      }
      return Promise.resolve(new Response(JSON.stringify({ status: "live" }), { status: 200, headers: { "content-type": "application/json" } }));
    } as typeof fetch;
    try {
      const c = new VbmfClient({ baseUrl: "", credentialProvider: () => "k" });
      const live = await c.healthLive();
      expect(live.status).toBe("live");
      expect(illegal).toBe(false);
    } finally {
      globalThis.fetch = orig;
    }
  });

  it("VbmfEventClient default fetch is bound", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = function (this: unknown, _input: RequestInfo | URL, _init?: RequestInit) {
      if (this == null) throw new TypeError("Illegal invocation");
      const stream = new ReadableStream({ pull() { /* keep open */ } });
      return Promise.resolve(new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } }));
    } as typeof fetch;
    try {
      const events = new VbmfEventClient({ baseUrl: "", credentialProvider: () => "k" });
      const handle = await events.streamEvents({
        onPayload: () => undefined,
        onTransportError: () => undefined,
        retryDelayMs: () => false,
      });
      handle.close();
    } finally {
      globalThis.fetch = orig;
    }
  });
});
