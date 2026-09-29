/**
 * SSE client (WCE-01E)。
 *
 * 永久边界：
 * - 浏览器原生 EventSource 不可设置自定义 header（x-api-key）→ 不可用；
 * - 唯一允许的方式：`fetch()` + ReadableStream + 自写 SSE frame parser；
 * - cursor tri-state：undefined = live tail；number = strictly-after；
 * - weak_ordering=true 必须如实传给上层——投影聚合无全局序；
 * - dedupe by sequence（`id:` = outbox sequence）；
 * - reload 重新从 canonical runtime snapshot 收敛，SSE 仅是增量。
 *
 * 本模块只暴露纯函数；UI 层做 backoff/重连策略以保持本模块易测。
 */
import { getApiKey } from "../auth/credentials.ts";
import type { SseFramePayload } from "./schemas.ts";

const STREAM_PATH = "/events/v1/stream";

export interface StreamHandle {
  close(): void;
  readonly lastSequence: () => number | null;
  readonly retryHintMs: number;
}

export interface StreamOptions {
  /** cursor = undefined → live tail；number → replay strictly-after 该 sequence */
  cursor?: number;
  signal?: AbortSignal;
  onPayload(payload: SseFramePayload): void;
  onHeartbeat?(): void;
  onError?(err: Error): void;
  /** 自定义 fetch（测试注入） */
  fetchImpl?: typeof fetch;
}

export function openEventStream(opts: StreamOptions): StreamHandle {
  const apiKey = getApiKey();
  const headers: Record<string, string> = { accept: "text/event-stream" };
  if (apiKey !== null) headers["x-api-key"] = apiKey;
  let url = STREAM_PATH;
  if (opts.cursor !== undefined) url += `?cursor=${opts.cursor}`;

  const fetchImpl = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  if (opts.signal !== undefined) {
    opts.signal.addEventListener("abort", () => ctrl.abort());
  }

  let lastSequence: number | null = null;
  let retryHintMs = 3000;
  let closed = false;
  let errored = false;
  const seen = new Set<number>();

  const close = (): void => {
    if (closed) return;
    closed = true;
    ctrl.abort();
  };

  /** transport 失败只上报一次（throw 与 EOF 互斥）。 */
  const fail = (err: Error): void => {
    if (closed || errored) return;
    errored = true;
    opts.onError?.(err);
  };

  void (async () => {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "GET",
        headers,
        signal: ctrl.signal,
      });
    } catch (err) {
      if (!closed) fail(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    if (!response.ok || response.body === null) {
      const text = await response.text().catch(() => "");
      fail(new Error(`SSE HTTP ${response.status}: ${text.slice(0, 200)}`));
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    try {
      while (!closed) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE 帧以空行 `\n\n` 分隔；逐帧解析。
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          parseFrame(frame);
        }
      }
    } catch (err) {
      if (!closed) fail(err instanceof Error ? err : new Error(String(err)));
    } finally {
      reader.releaseLock();
    }
    // 真实服务器/代理断流可能以干净 EOF（read → done=true）结束而非 throw；
    // operator close 已置 closed=true，不会误判为失败。
    if (!closed) fail(new Error("SSE stream ended unexpectedly (EOF)"));
  })();

  function parseFrame(raw: string): void {
    // SSE 注释行（`: heartbeat`）以冒号起头；event/id/data 行解析。
    const lines = raw.split(/\r?\n/);
    let eventName = "";
    let id: string | null = null;
    let data = "";
    for (const line of lines) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("retry:")) {
        const m = /^retry:\s*(\d+)/.exec(line);
        if (m !== null && m[1] !== undefined) {
          const n = Number.parseInt(m[1], 10);
          if (Number.isFinite(n) && n > 0) retryHintMs = n;
        }
        continue;
      }
      const colon = line.indexOf(":");
      if (colon === -1) continue;
      const field = line.slice(0, colon);
      const value = line.slice(colon + 1).replace(/^ /, "");
      if (field === "event") eventName = value;
      else if (field === "id") id = value;
      else if (field === "data") data += value;
    }
    if (eventName === "projection" && data.length > 0) {
      try {
        const payload = JSON.parse(data) as SseFramePayload;
        if (typeof payload.sequence !== "number") return;
        if (seen.has(payload.sequence)) return;
        seen.add(payload.sequence);
        lastSequence = payload.sequence;
        opts.onPayload(payload);
      } catch {
        // 帧格式非法 = SSE 链契约违例：先终止当前流（close 置 closed 并
        // abort，杜绝旧流继续读取与重连后的并行双 transport），再让上层
        // 以 backoff 重连新流。
        close();
        opts.onError?.(new Error("SSE payload is not valid JSON"));
      }
    } else if (eventName === "" && data === "" && id === null) {
      // 注释帧（如 heartbeat）→ 调用方可选通知。
      opts.onHeartbeat?.();
    } else if (id !== null && data === "") {
      // 仅 id，无数据（如 heartbeat）→ 不视为 sequence。
    }
  }

  return {
    close,
    lastSequence: () => lastSequence,
    get retryHintMs() {
      return retryHintMs;
    },
  };
}
