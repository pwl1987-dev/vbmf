/**
 * SSE parser tests (WCE-01E)。
 * 覆盖：cursor tri-state、retry hint、weak_ordering 透传、heartbeat 注释帧、
 * sequence dedupe、JSON 解析失败处理、reconnect cursor 透传。
 */
import { describe, expect, it, beforeEach } from "vitest";
import { setApiKey } from "../src/auth/credentials.ts";

function makeStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  let i = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i] ?? ""));
        i += 1;
      } else {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function fakeFetch(response: Response): typeof fetch {
  return (async () => response) as typeof fetch;
}

beforeEach(() => {
  setApiKey("vbmf_test");
});

describe("openEventStream", () => {
  it("emits payload for projection frames with id + data", async () => {
    const payload = {
      sequence: 42,
      observed_at_ms: 1_700_000_000_000,
      weak_ordering: true,
      snapshot: { total: 1 },
    };
    const res = makeStreamResponse([
      `id: 42\nevent: projection\ndata: ${JSON.stringify(payload)}\n\n`,
    ]);
    const received: unknown[] = [];
    const handle = (await import("../src/api/sse.ts")).openEventStream({
      fetchImpl: fakeFetch(res),
      onPayload: (p) => received.push(p),
    });
    await new Promise((r) => setTimeout(r, 50));
    handle.close();
    expect(received).toHaveLength(1);
    const first = received[0] as { sequence: number; weak_ordering: boolean };
    expect(first.sequence).toBe(42);
    expect(first.weak_ordering).toBe(true);
    expect(handle.lastSequence()).toBe(42);
  });

  it("dedupes repeated sequence (at-least-once semantics)", async () => {
    const payload = { sequence: 7, observed_at_ms: 1, weak_ordering: true, snapshot: {} };
    const frame = `id: 7\nevent: projection\ndata: ${JSON.stringify(payload)}\n\n`;
    const res = makeStreamResponse([frame, frame]);
    const received: unknown[] = [];
    const handle = (await import("../src/api/sse.ts")).openEventStream({
      fetchImpl: fakeFetch(res),
      onPayload: (p) => received.push(p),
    });
    await new Promise((r) => setTimeout(r, 50));
    handle.close();
    expect(received).toHaveLength(1);
  });

  it("treats heartbeat (comment) frames as no-op", async () => {
    const res = makeStreamResponse([": heartbeat\n\n"]);
    const received: unknown[] = [];
    const handle = (await import("../src/api/sse.ts")).openEventStream({
      fetchImpl: fakeFetch(res),
      onPayload: (p) => received.push(p),
    });
    await new Promise((r) => setTimeout(r, 50));
    handle.close();
    expect(received).toHaveLength(0);
  });

  it("extracts retry hint", async () => {
    const res = makeStreamResponse(["retry: 5000\n\n"]);
    const handle = (await import("../src/api/sse.ts")).openEventStream({
      fetchImpl: fakeFetch(res),
      onPayload: () => undefined,
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(handle.retryHintMs).toBe(5000);
    handle.close();
  });

  it("forwards cursor query parameter for replay", async () => {
    let captured: string | null = null;
    const fetchImpl: typeof fetch = (async (input: RequestInfo | URL) => {
      captured = typeof input === "string" ? input : input.toString();
      return makeStreamResponse([]);
    }) as typeof fetch;
    const handle = (await import("../src/api/sse.ts")).openEventStream({
      fetchImpl,
      cursor: 99,
      onPayload: () => undefined,
    });
    await new Promise((r) => setTimeout(r, 50));
    handle.close();
    expect(captured).not.toBeNull();
    expect(captured).toContain("/events/v1/stream");
    expect(captured).toContain("cursor=99");
  });

  it("unexpected EOF (server closes stream) signals error for reconnect", async () => {
    const payload = { sequence: 11, observed_at_ms: 1, weak_ordering: true, snapshot: {} };
    const res = makeStreamResponse([
      `id: 11\nevent: projection\ndata: ${JSON.stringify(payload)}\n\n`,
    ]); // stream closes after the frame → reader.read() resolves done=true
    const errs: Error[] = [];
    const received: unknown[] = [];
    const handle = (await import("../src/api/sse.ts")).openEventStream({
      fetchImpl: fakeFetch(res),
      onPayload: (p) => received.push(p),
      onError: (e) => errs.push(e),
    });
    await new Promise((r) => setTimeout(r, 50));
    handle.close();
    expect(received).toHaveLength(1);
    expect(errs.length).toBeGreaterThanOrEqual(1);
    expect(errs[0]!.message).toMatch(/EOF|ended|closed|stream/i);
  });

  it("operator close is NOT reported as a failure", async () => {
    const res = makeStreamResponse([]);
    const errs: Error[] = [];
    const handle = (await import("../src/api/sse.ts")).openEventStream({
      fetchImpl: fakeFetch(res),
      onPayload: () => undefined,
      onError: (e) => errs.push(e),
    });
    handle.close();
    await new Promise((r) => setTimeout(r, 50));
    expect(errs).toHaveLength(0);
  });

  it("malformed JSON frame terminates the stream before signaling error (no parallel transport)", async () => {
    const good = { sequence: 20, observed_at_ms: 1, weak_ordering: true, snapshot: {} };
    const after = { sequence: 21, observed_at_ms: 2, weak_ordering: true, snapshot: {} };
    // Build a stream that delivers: good frame, malformed frame, then a good frame.
    const encoder = new TextEncoder();
    const late: { fn: ((chunk: string) => void) | null } = { fn: null };
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`id: 20\nevent: projection\ndata: ${JSON.stringify(good)}\n\n`));
        controller.enqueue(encoder.encode("id: x\nevent: projection\ndata: {not json}\n\n"));
        late.fn = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      },
    });
    const fetchImpl: typeof fetch = (async () =>
      new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } })) as typeof fetch;
    const errs: Error[] = [];
    const received: unknown[] = [];
    const handle = (await import("../src/api/sse.ts")).openEventStream({
      fetchImpl,
      onPayload: (p) => received.push(p),
      onError: (e) => errs.push(e),
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(received).toHaveLength(1); // frame before the violation
    expect(errs.length).toBeGreaterThanOrEqual(1);
    expect(errs[0]!.message).toMatch(/JSON/i);
    // anything the server still pushes on the OLD (terminated) transport must
    // not reach the UI — the old stream is dead, the caller reconnects fresh.
    late.fn?.(`id: 21\nevent: projection\ndata: ${JSON.stringify(after)}\n\n`);
    await new Promise((r) => setTimeout(r, 50));
    expect(received).toHaveLength(1);
    handle.close();
  });

  it("invokes onError on HTTP non-2xx", async () => {
    const fetchImpl = (async () =>
      new Response("boom", { status: 503, headers: { "content-type": "text/plain" } })) as typeof fetch;
    const errs: Error[] = [];
    const handle = (await import("../src/api/sse.ts")).openEventStream({
      fetchImpl,
      onPayload: () => undefined,
      onError: (e) => errs.push(e),
    });
    await new Promise((r) => setTimeout(r, 50));
    handle.close();
    expect(errs.length).toBeGreaterThanOrEqual(1);
  });
});
