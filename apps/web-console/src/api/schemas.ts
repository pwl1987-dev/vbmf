/**
 * Web Console types — SDK-01D dogfood 后：类型 100% 来自 @vbmf/sdk（其本身
 * 由 apps/api/src/routes/schemas.ts JSON Schema 单源机械派生，drift-gated）。
 * WCE-01A 时代的手工 TS mirror 已删除（Debt C 清偿）—— 本文件只剩 re-export。
 *
 * 红线不变：Web Console 不发明 parallel schema；JSON Schema 运行时常量仍从
 * apps/api 单源 re-export（测试/契约验证用）。
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
} from "@vbmf/sdk";

// 产品类型别名（Web Console 页面消费面保持稳定命名）
export type SessionState = NonNullable<RuntimeSnapshot["sessions"][number]["state"]>;
export type SessionPhase = NonNullable<RuntimeSnapshot["sessions"][number]["phase"]>;
export type CommandState = NonNullable<CommandOperationBody["state"]>;
export type ProductSession = RuntimeSnapshot["sessions"][number];
export type HealthLayer = HealthLayersResponse["layers"]["api"];

import type {
  RuntimeSnapshot,
  CommandOperationBody,
  HealthLayersResponse,
} from "@vbmf/sdk";

export {
  ROUTE_SCHEMAS,
  ERROR_CODE_VALUES,
  errorEnvelopeSchema,
  productSessionSchema,
  runtimeSnapshotSchema,
  commandOperationBodySchema,
  commandStateSchema,
  startSessionBodySchema,
  graphRuntimeIntentSchema,
  sessionActionBodySchema,
  healthLayersSchema,
  healthLiveSchema,
  sseFramePayloadSchema,
} from "../../../api/src/routes/schemas.ts";

export type {
  RouteSchemaEntry,
} from "../../../api/src/routes/schemas.ts";
