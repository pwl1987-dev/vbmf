/**
 * Web Console types — single source = apps/api/src/routes/schemas.ts (Fastify
 * 端 WCE-01A)。Web Console 不发明 parallel schema。
 *
 * 本文件只做两件事：
 *   1) 把 Fastify JSON Schema 重导出（运行时类型与 schema 同源）
 *   2) 从 JSON Schema 推导 TS 类型（by-hand mirror·保持 schema 与类型一致）
 *
 * 注意：手工 mirror 只能与 schemas.ts 同步更新；任何 schemas.ts 改动后必须
 * 同步本文件——CI 通过 `test/schemas.authority.test.ts` 兜底（schema 字段
 * 与 TS 类型一一比对）。
 */
export {
  ROUTE_SCHEMAS,
  ERROR_CODE_VALUES,
  errorEnvelopeSchema,
  productSessionSchema,
  runtimeSnapshotSchema,
  commandOperationBodySchema,
  commandStateSchema,
  startSessionBodySchema,
  sessionActionBodySchema,
  healthLayersSchema,
  healthLiveSchema,
  sseFramePayloadSchema,
} from "../../../api/src/routes/schemas.ts";

export type {
  RouteSchemaEntry,
} from "../../../api/src/routes/schemas.ts";

// ---------- 从 schema 推导 TS 类型（手工 mirror；schema 与 TS 必须同步） ----------

export type ErrorCode =
  | "AUTHENTICATION_FAILED"
  | "AUTHORIZATION_DENIED"
  | "VALIDATION_ERROR"
  | "RESOURCE_NOT_FOUND"
  | "RESOURCE_CONFLICT"
  | "RESOURCE_UNAVAILABLE"
  | "CAPABILITY_UNSUPPORTED"
  | "COMMAND_REJECTED"
  | "COMMAND_FAILED"
  | "DEPENDENCY_UNAVAILABLE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    request_id: string;
    retryable: boolean;
  };
}

export type SessionState =
  | "reserved"
  | "running"
  | "paused"
  | "releasing"
  | "released"
  | "terminated";

export type SessionPhase =
  | "requested"
  | "provisioning"
  | "binding"
  | "leased"
  | "starting"
  | "running"
  | "stopping"
  | "released"
  | "failed";

export interface ProductSession {
  id: string;
  label: string;
  state: SessionState;
  phase: SessionPhase;
  outputs: string[];
  inputs: { id: string; handle: number }[];
}

export interface RuntimeSnapshot {
  devices: Record<string, unknown>[];
  ports: Record<string, unknown>[];
  resources: Record<string, unknown>[];
  sessions: ProductSession[];
  capabilities: Record<string, unknown>[];
  program_switch: Record<string, unknown> | null;
  generated_at_ms: number;
  observation_revision: number;
  observation_lineage: string;
}

export type CommandState =
  | "pending"
  | "completed"
  | "failed"
  | "timeout"
  | "conflict"
  | "rejected";

export interface CommandOperationBody {
  command_id: string;
  state: CommandState;
  kind: "start_session" | "stop_session" | "release_session";
  created_at: string;
  classification?: string;
  detail?: string;
  verdict?: Record<string, unknown>;
  terminal_at?: string;
}

export interface StartSessionBody {
  intent: {
    version: string;
    devices: Record<string, unknown>[];
  };
  command_id?: string;
}

export interface HealthLayer {
  status: string;
  observed_at_ms?: number;
  [extra: string]: unknown;
}

export interface HealthLayersResponse {
  checked_at_ms: number;
  layers: {
    api: HealthLayer;
    runtime: HealthLayer;
    db: HealthLayer;
    auth: HealthLayer;
    events: HealthLayer;
  };
}

export interface HealthLiveResponse {
  status: "live";
}

export interface SseFramePayload {
  sequence: number;
  observed_at_ms: number;
  weak_ordering: true;
  snapshot: Record<string, unknown>;
}
