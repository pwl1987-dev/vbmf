/**
 * SDK Event client（SDK-01C · planning S7 冻结）。
 *
 * 语义 100% 继承 2026-09-29 BMD 真机验证（WEB-CONSOLE-BMD-ACCEPTANCE-01
 * BUG-A 修复后形态）：
 * - fetch + ReadableStream 自解析 SSE 帧（native EventSource 无法携带
 *   x-api-key header，不可用）；
 * - cursor tri-state：undefined = live tail；number = replay strictly-after；
 * - at-least-once：dedupe by sequence（`id:` = outbox sequence）；
 * - weak_ordering=true 如实透传 —— 投影内容聚合无全局序，SDK 不宣称排序；
 * - unexpected EOF（read done=true）= transport 失败信号 → 重连；
 * - malformed JSON 帧 = 契约违例 → 先终止当前流（杜绝并行双 transport）
 *   再上报错误 → 由 backoff 策略重连；
 * - operator close / AbortSignal 不误判为失败；
 * - 单 active transport：重连前显式关闭旧流。
 *
 * Backoff 策略由调用方注入（`shouldReconnect` 返回 false 或不提供 = 不自动
 * 重连，直接 end）；默认阶梯 500/1000/2000/5000/10000ms（封顶 10000）。
 */
import type { SseFramePayload } from "./generated/types.ts";
import type { CredentialProvider } from "./transport.ts";

export interface EventStreamOptions {
  /** undefined = live tail；number = replay strictly-after 该 sequence。 */
  cursor?: number;
  signal?: AbortSignal;
  onPayload(payload: SseFramePayload): void;
  /** transport 级错误（网络/EOF/malformed）——返回后流已终止。 */
  onTransportError(err: Error): void;
  /** 干净结束（operator close / abort / server 正常关闭由 onTransportError 报）。 */
  onEnd?(): void;
  /** 自定义 backoff：attempt 从 0 起；返回 false = 停止重连。 */
  retryDelayMs?(attempt: number): number | false;
  fetchImpl?: typeof fetch;
}

export interface EventStreamHandle {
  close(): void;
  readonly lastSequence: () => number | null;
  readonly retryHintMs: number;
}

export interface EventClientOptions {
  baseUrl: string;
  credentialProvider: CredentialProvider;
  fetchImpl?: typeof fetch;
}

const DEFAULT_BACKOFF_MS = [500, 1000, 2000, 5000, 10000] as const;
const STREAM_PATH = "/events/v1/stream";

export class VbmfEventClient {
  private readonly baseUrl: string;
  private readonly credentialProvider: CredentialProvider;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: EventClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.credentialProvider = opts.credentialProvider;
    // bind(globalThis)：浏览器中未绑定的 fetch 引用裸调用抛 Illegal
    // invocation（真浏览器 BMD 实证 BUG-H；Node 注入路径此前掩盖）。
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * 建立事件流。Handle 拥有唯一 transport；同一 handle 生命周期内至多一条
   * active stream。收流期间的 sequence 续传游标跨重连保留（lastSequence）。
   */
  async streamEvents(opts: EventStreamOptions): Promise<EventStreamHandle> {
    let closed = false;
    let lastSequence: number | null = opts.cursor ?? null;
    let retryHintMs = 3000;
    let attempt = 0;
    let currentAbort: AbortController | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const seen = new Set<number>();
    const retryDelay = opts.retryDelayMs ?? ((n: number) => DEFAULT_BACKOFF_MS[Math.min(n, DEFAULT_BACKOFF_MS.length - 1)] ?? 10000);

    const handle: EventStreamHandle = {
      close: () => {
        if (closed) return;
        closed = true;
        if (retryTimer !== null) clearTimeout(retryTimer);
        currentAbort?.abort();
        opts.onEnd?.();
      },
      lastSequence: () => lastSequence,
      get retryHintMs() {
        return retryHintMs;
      },
    };

    if (opts.signal !== undefined) {
      opts.signal.addEventListener("abort", () => handle.close(), { once: true });
    }

    const fail = (err: Error): void => {
      if (closed) return;
      opts.onTransportError(err);
      const delay = retryDelay(attempt);
      attempt += 1;
      if (delay === false || closed) {
        if (!closed) handle.close();
        return;
      }
      retryTimer = setTimeout(() => {
        if (!closed) void open();
      }, delay);
    };

    const open = async (): Promise<void> => {
      if (closed) return;
      currentAbort?.abort(); // 单 active transport：新流前关旧流
      const ctrl = new AbortController();
      currentAbort = ctrl;
      // streamClosed 只标记"本条流已终止"（malformed 违例路径）；绝不复用
      // closed（那是 operator close 语义）—— 复用会吞掉违例上报。
      let streamClosed = false;
      const closeStream = (): void => {
        if (streamClosed) return;
        streamClosed = true;
        ctrl.abort();
      };

      const apiKey = await this.credentialProvider();
      const headers: Record<string, string> = { accept: "text/event-stream" };
      if (apiKey.length > 0) headers["x-api-key"] = apiKey;
      const url =
        lastSequence !== null ? `${this.baseUrl}${STREAM_PATH}?cursor=${lastSequence}` : `${this.baseUrl}${STREAM_PATH}`;

      let response: Response;
      try {
        response = await this.fetchImpl(url, { method: "GET", headers, signal: ctrl.signal });
      } catch (err) {
        if (closed || streamClosed) return; // operator close/abort
        fail(err instanceof Error ? err : new Error(String(err)));
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
      let errored = false;
      const reportFail = (err: Error): void => {
        if (errored || closed) return;
        errored = true;
        fail(err);
      };

      try {
        while (!closed && !errored) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sep: number;
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            parseFrame(frame);
            if (errored) break;
          }
        }
      } catch (err) {
        if (!closed && !errored) reportFail(err instanceof Error ? err : new Error(String(err)));
      } finally {
        reader.releaseLock();
      }
      // unexpected EOF：server/代理干净断流（read → done）且非 operator close
      // —— 必须触发重连（BMD 验证语义）；operator close 已置 closed。
      if (!closed && !errored) {
        reportFail(new Error("SSE stream ended unexpectedly (EOF)"));
      }

      function parseFrame(raw: string): void {
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
            if (seen.has(payload.sequence)) return; // at-least-once dedupe
            seen.add(payload.sequence);
            lastSequence = payload.sequence;
            attempt = 0; // 成功帧重置 backoff 阶梯
            opts.onPayload(payload);
          } catch {
            // 契约违例：终止当前流（杜绝旧流继续读取 + 并行 transport），上报。
            closeStream();
            reportFail(new Error("SSE payload is not valid JSON"));
          }
        }
        // 心跳/注释帧（": heartbeat"）与仅 id 帧不产生 payload。
      }
    };

    void open();
    return handle;
  }
}
