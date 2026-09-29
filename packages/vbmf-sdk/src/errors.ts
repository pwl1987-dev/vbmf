/**
 * SDK error model（planning S4 冻结）。
 *
 * 红线：错误不得被吞 —— 禁止 catch→null/false/success。每次失败都抛
 * `VbmfApiError`，保留：
 * - HTTP status（网络层失败 = 0）；
 * - Product ErrorEnvelope（网络层失败由 SDK 按同一 envelope 形态合成
 *   DEPENDENCY_UNAVAILABLE —— consumer 用同一代码路径处理）；
 * - request_id / retryable；
 * - 429 的 Retry-After（解析为 retryAfterMs；无该头 = null）。
 */
import type { ErrorEnvelope } from "./generated/types.ts";

export class VbmfApiError extends Error {
  readonly status: number;
  readonly envelope: ErrorEnvelope;
  readonly retryAfterMs: number | null;

  constructor(status: number, envelope: ErrorEnvelope, retryAfterMs: number | null = null) {
    super(`VBMF API error ${envelope.error.code} (HTTP ${status}): ${envelope.error.message}`);
    this.name = "VbmfApiError";
    this.status = status;
    this.envelope = envelope;
    this.retryAfterMs = retryAfterMs;
  }

  get code(): string {
    return this.envelope.error.code;
  }

  get retryable(): boolean {
    return this.envelope.error.retryable;
  }

  get requestId(): string {
    return this.envelope.error.request_id;
  }
}

/** 网络层失败（不可达/abort/中断）→ 与 Product envelope 同形态的合成错误。 */
export function networkFailureError(cause: unknown): VbmfApiError {
  const message = cause instanceof Error ? cause.message : String(cause);
  return new VbmfApiError(
    0,
    {
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: `network failure: ${message.slice(0, 240)}`,
        request_id: "client-generated",
        retryable: true,
      },
    },
    null,
  );
}

/** 响应体非法（非 JSON / 非 envelope）→ 合成 INTERNAL_ERROR（绝不假成功）。 */
export function malformedResponseError(status: number, detail: string): VbmfApiError {
  return new VbmfApiError(
    status,
    {
      error: {
        code: "INTERNAL_ERROR",
        message: `malformed product response: ${detail.slice(0, 240)}`,
        request_id: "client-generated",
        retryable: status >= 500,
      },
    },
    null,
  );
}

/** Retry-After 头（秒）→ 毫秒；缺失/非法 → null。 */
export function parseRetryAfterMs(headerValue: string | null): number | null {
  if (headerValue === null) return null;
  const seconds = Number.parseInt(headerValue, 10);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return seconds * 1000;
}
