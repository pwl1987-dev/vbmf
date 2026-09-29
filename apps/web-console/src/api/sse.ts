/**
 * SSE client（WCE-01E · SDK-01D dogfood：transport 切换到 @vbmf/sdk
 * VbmfEventClient —— 2026-09-29 BMD 真机验证语义的同一实现）。
 *
 * 永久边界：
 * - 浏览器原生 EventSource 不可设置自定义 header（x-api-key）→ 不可用；
 * - cursor tri-state：undefined = live tail；number = strictly-after；
 * - weak_ordering=true 必须如实传给上层——投影聚合无全局序；
 * - dedupe by sequence（`id:` = outbox sequence）；
 * - reload 重新从 canonical runtime snapshot 收敛，SSE 仅是增量。
 *
 * 分工：SDK 拥有帧解析/EOF 语义/malformed 终止/单 transport；**重连策略
 * 归页面**（EventsPage 的 backoff/cursor UI 状态机）—— 本包装禁用 SDK 自动
 * 重连（retryDelayMs → false），把 transport 错误原样交给 onError。
 */
import { VbmfEventClient, type EventStreamHandle as SdkStreamHandle } from "@vbmf/sdk";
import { getApiKey } from "../auth/credentials.ts";
import type { SseFramePayload } from "./schemas.ts";

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
  onError?(err: Error): void;
  /** 自定义 fetch（测试注入） */
  fetchImpl?: typeof fetch;
}

export function openEventStream(opts: StreamOptions): StreamHandle {
  let closed = false;
  let lastSeq: number | null = opts.cursor ?? null;
  let retryHintMs = 3000;
  let sdkHandle: SdkStreamHandle | null = null;

  const client = new VbmfEventClient({
    baseUrl: "",
    credentialProvider: () => getApiKey() ?? "",
    ...(opts.fetchImpl !== undefined ? { fetchImpl: opts.fetchImpl } : {}),
  });

  void client
    .streamEvents({
      ...(opts.cursor !== undefined ? { cursor: opts.cursor } : {}),
      ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
      onPayload: (payload) => {
        lastSeq = payload.sequence;
        opts.onPayload(payload);
      },
      onTransportError: (err) => {
        if (!closed) opts.onError?.(err);
      },
      // 页面拥有重连策略（backoff/cursor UI 状态机）—— SDK 只报错不自动重连。
      retryDelayMs: () => false,
    })
    .then((h) => {
      sdkHandle = h;
      if (closed) h.close(); // close 先于 handle 就绪的竞态兜底
      retryHintMs = h.retryHintMs;
    })
    .catch((err: unknown) => {
      if (!closed) opts.onError?.(err instanceof Error ? err : new Error(String(err)));
    });

  return {
    close: () => {
      if (closed) return;
      closed = true;
      sdkHandle?.close();
    },
    lastSequence: () => sdkHandle?.lastSequence() ?? lastSeq,
    get retryHintMs() {
      return sdkHandle !== null ? sdkHandle.retryHintMs : retryHintMs;
    },
  };
}
