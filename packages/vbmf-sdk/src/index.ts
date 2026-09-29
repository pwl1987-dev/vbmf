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
 * - credential 经 provider callback 注入，SDK 不持久化（S3）。
 *
 * SDK-01A 阶段：导出类型；client（SDK-01B）与 event 流（SDK-01C）增量加入。
 */
export type {
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
