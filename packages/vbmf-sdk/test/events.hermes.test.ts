/**
 * SDK-01C hermetic 测试 —— SSE 语义（继承 BMD 验证的 api.sse 语义全谱）。
 *
 * 覆盖：帧解析/heartbeat/retry hint、cursor tri-state、dedupe、
 * unexpected EOF → 重连、malformed → 终止旧流 + 重连、operator close 不误报、
 * 单 active transport、abort、成功帧重置 backoff。
 */
import { describe, expect, it, vi } from "vitest";
import { VbmfEventClient } from "../src/events.ts";

function streamResponse(chunks: string[], onPull?: (deliver: (chunk: string) => void) => void): Response {
  const encoder = new TextEncoder();
  let i = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (onPull !== undefined) {
        onPull((chunk: string) => controller.enqueue(encoder.encode(chunk)));
      }
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i] ?? ""));
        i += 1;
      } else {
        controller.close();
      }
    },
  });
  return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
}

function frame(sequence: number): string {
  const payload = { sequence, observed_at_ms: 1000 + sequence, weak_ordering: true, snapshot: { total: sequence } };
  return `id: ${sequence}\nevent: projection\ndata: ${JSON.stringify(payload)}\n\n`;
}

function makeClient(responses: Array<() => Response>): { client: VbmfEventClient; urls: string[] } {
  const urls: string[] = [];
  let call = 0;
  const client = new VbmfEventClient({
    baseUrl: "https://vbmf.test",
    credentialProvider: () => "k-test",
    fetchImpl: (async (input: RequestInfo | URL) => {
      urls.push(String(input));
      const make = responses[Math.min(call, responses.length - 1)]!;
      call += 1;
      return make();
    }) as typeof fetch,
  });
  return { client, urls };
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe("VbmfEventClient (hermetic)", () => {
  it("emits projection frames; heartbeat ignored; retry hint parsed", async () => {
    const { client } = makeClient([() => streamResponse([": heartbeat\n\n", "retry: 5000\n\n", frame(7)])]);
    const got: number[] = [];
    const handle = await client.streamEvents({
      onPayload: (p) => got.push(p.sequence),
      onTransportError: () => undefined,
      retryDelayMs: () => false,
    });
    await sleep(80);
    handle.close();
    expect(got).toEqual([7]);
    expect(handle.lastSequence()).toBe(7);
    expect(handle.retryHintMs).toBe(5000);
  });

  it("live tail = no cursor param; reconnect carries cursor=lastSequence (strictly-after)", async () => {
    const { client, urls } = makeClient([
      () => streamResponse([frame(1), frame(2)]), // stream 1 ends → EOF → reconnect
      () => streamResponse([frame(3)]),
    ]);
    const got: number[] = [];
    const handle = await client.streamEvents({
      onPayload: (p) => got.push(p.sequence),
      onTransportError: () => undefined,
      retryDelayMs: () => 5,
    });
    await sleep(150);
    handle.close();
    expect(urls[0]).toBe("https://vbmf.test/events/v1/stream");
    expect(urls[1]).toBe("https://vbmf.test/events/v1/stream?cursor=2");
    expect(got).toEqual([1, 2, 3]);
  });

  it("duplicate sequences are suppressed across reconnects (at-least-once)", async () => {
    const { client } = makeClient([
      () => streamResponse([frame(5)]),
      () => streamResponse([frame(5), frame(6)]), // replay includes 5 again
    ]);
    const got: number[] = [];
    const handle = await client.streamEvents({
      onPayload: (p) => got.push(p.sequence),
      onTransportError: () => undefined,
      retryDelayMs: () => 5,
    });
    await sleep(150);
    handle.close();
    expect(got).toEqual([5, 6]);
  });

  it("malformed JSON frame terminates the old stream and reconnects (no parallel transport)", async () => {
    const late: { fn: ((c: string) => void) | null } = { fn: null };
    const good = frame(20);
    const malformed = "id: x\nevent: projection\ndata: {not json}\n\n";
    const first = () =>
      new Response(
        new ReadableStream({
          start(controller) {
            const enc = new TextEncoder();
            controller.enqueue(enc.encode(good));
            controller.enqueue(enc.encode(malformed));
            late.fn = (c: string) => controller.enqueue(enc.encode(c));
          },
        }),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      );
    const { client, urls } = makeClient([first, () => streamResponse([frame(21)])]);
    const got: number[] = [];
    const errors: Error[] = [];
    const handle = await client.streamEvents({
      onPayload: (p) => got.push(p.sequence),
      onTransportError: (e) => errors.push(e),
      retryDelayMs: () => 80, // 固定窗口：违例上报与重连之间的确定性间隔
    });
    await sleep(30);
    expect(got).toEqual([20]); // 只有违例前的帧（重连尚未发生）
    expect(errors.some((e) => /JSON/i.test(e.message))).toBe(true);
    await sleep(200);
    // 旧（已终止）transport 上再推送的帧不得到达 —— 只有重连流能交付。
    late.fn?.(frame(99));
    await sleep(60);
    handle.close();
    expect(got).toEqual([20, 21]); // dedupe：重放/EOF 重连不产生重复
    expect(urls.length).toBeGreaterThanOrEqual(2); // EOF 后续重连是产品语义
    expect(urls[0]).not.toContain("cursor");
    expect(urls[1]).toContain("cursor=20");
  });

  it("operator close is not reported as transport error; abort also clean", async () => {
    // 挂起流（server 保持连接、无更多帧）——operator close/abort 期间的
    // read 中断不得被误判为 transport 失败（BMD 验证语义）。
    const pendingStream = (): Response =>
      new Response(
        new ReadableStream({ pull() { /* server keeps the stream open */ } }),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      );
    const errors: Error[] = [];
    const ended: boolean[] = [];
    const { client } = makeClient([pendingStream]);
    const handle = await client.streamEvents({
      onPayload: () => undefined,
      onTransportError: (e) => errors.push(e),
      onEnd: () => ended.push(true),
      retryDelayMs: () => false,
    });
    await sleep(40);
    handle.close();
    await sleep(40);
    expect(errors).toEqual([]);
    expect(ended).toEqual([true]);

    const ctrl = new AbortController();
    const errors2: Error[] = [];
    const { client: c2 } = makeClient([pendingStream]);
    const h2 = await c2.streamEvents({
      signal: ctrl.signal,
      onPayload: () => undefined,
      onTransportError: (e) => errors2.push(e),
      retryDelayMs: () => 5,
    });
    await sleep(30);
    ctrl.abort();
    await sleep(60);
    expect(errors2).toEqual([]);
    expect(h2.lastSequence()).toBeNull();
  });

  it("successful frames reset the backoff ladder", async () => {
    const delays: number[] = [];
    const { client } = makeClient([
      () => streamResponse([]), // HTTP OK empty stream → EOF immediately
      () => streamResponse([frame(1)]),
      () => streamResponse([frame(2)]),
    ]);
    const handle = await client.streamEvents({
      onPayload: () => undefined,
      onTransportError: () => undefined,
      retryDelayMs: (n) => {
        delays.push(n);
        return [50, 100, 200][Math.min(n, 2)] ?? 200;
      },
    });
    await sleep(400);
    handle.close();
    // ladder saw attempt resets (0 again after a successful frame on stream 2)
    expect(delays[0]).toBe(0);
    expect(delays.includes(0, 1)).toBe(true);
  });

  it("retryDelayMs returning false stops reconnection after error", async () => {
    const errors: Error[] = [];
    let calls = 0;
    const client = new VbmfEventClient({
      baseUrl: "https://vbmf.test",
      credentialProvider: () => "k",
      fetchImpl: (async () => {
        calls += 1;
        throw new TypeError("down");
      }) as unknown as typeof fetch,
    });
    const handle = await client.streamEvents({
      onPayload: () => undefined,
      onTransportError: (e) => errors.push(e),
      retryDelayMs: () => false,
    });
    await sleep(60);
    expect(errors).toHaveLength(1);
    expect(calls).toBe(1); // no retry
    handle.close();
  });
});
