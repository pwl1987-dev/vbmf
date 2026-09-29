/**
 * @vbmf/sdk — VBMF TypeScript SDK（SDK-ENTRY-01）。
 *
 * 边界（planning S1-S8 冻结）：
 * - 仅消费 Product API / Event API / Health API（baseUrl 可配置，但 SDK
 *   永不指向内部 Runtime Control 面或媒体设备面 —— 静态红线 gate 守护）；
 * - Runtime owns truth：SDK 不缓存可变 Runtime 状态；命令语义 =
 *   CommandOperation ≠ Runtime actual（S5）；
 * - 类型 100% 机械派生自 apps/api/src/routes/schemas.ts（src/generated，
 *   drift-gated），SDK 不手写 wire 类型；发布物不依赖 apps/api 源码；
 * - credential 经 provider callback 注入，SDK 不持久化（S3）；
 * - write 命令显式 idempotency key，无自动重试（S6）。
 */
export type {
  AlarmItem,
  ErrorCode,
  ErrorEnvelope,
  RuntimeSnapshot,
  CommandOperationBody,
  GraphRuntimeIntent,
  StartSessionBody,
  HealthLayersResponse,
  HealthLiveResponse,
  SseFramePayload,
} from "./generated/types.ts";

export { VbmfApiError, networkFailureError, malformedResponseError, parseRetryAfterMs } from "./errors.ts";
export type { CredentialProvider } from "./transport.ts";
export { VbmfClient } from "./client.ts";
export type { VbmfClientOptions } from "./client.ts";
export { VbmfEventClient } from "./events.ts";
export type { EventClientOptions, EventStreamOptions, EventStreamHandle } from "./events.ts";
