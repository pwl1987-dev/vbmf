/**
 * WEB-CONSOLE-ENTRY-01 / WCE-01A — Product API JSON Schema Authority.
 *
 * 单源（single source of truth）= 本文件。每个 route 的 wire shape 在此集中
 * 表达为标准 JSON Schema（JSON Schema Draft 2020-12），Fastify 在 register 时
 * 把它附着到 `schema:` 配置项做运行时序列化/校验，Web Console 经 TypeScript
 * relative path（apps/web-console/src/api/schemas.ts）复用同一来源。
 *
 * 禁止修改本文件以"美化/对齐"——schema 必须描述现有已经验证的 wire 行为；
 * 若运行时响应不匹配 schema，先排查代码，不得改 schema 迎合。
 *
 * 命名形态：
 * - XxxBody：请求 body
 * - XxxParams：路径参数
 * - XxxQuery：querystring
 * - XxxResponse2xx / 4xx / 5xx：响应 envelope（与 EXTERNAL_API_CONTRACT §5 错误模型对齐）
 *
 * 12 个 ErrorCode 词表与 `lib/errors.ts` 一致；新增 code 必须同时更新两边。
 */
import type { FastifySchema } from "fastify";

// ---------- 错误模型 envelope（与 lib/errors.ts ErrorCode 12 词表对齐） ----------

export const ERROR_CODE_VALUES = [
  "AUTHENTICATION_FAILED",
  "AUTHORIZATION_DENIED",
  "VALIDATION_ERROR",
  "RESOURCE_NOT_FOUND",
  "RESOURCE_CONFLICT",
  "RESOURCE_UNAVAILABLE",
  "CAPABILITY_UNSUPPORTED",
  "COMMAND_REJECTED",
  "COMMAND_FAILED",
  "DEPENDENCY_UNAVAILABLE",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODE_VALUES)[number];

export const errorEnvelopeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["error"],
  properties: {
    error: {
      type: "object",
      additionalProperties: false,
      required: ["code", "message", "request_id", "retryable"],
      properties: {
        code: { type: "string", enum: [...ERROR_CODE_VALUES] },
        message: { type: "string" },
        details: { type: "object", additionalProperties: true },
        request_id: { type: "string", minLength: 1 },
        retryable: { type: "boolean" },
      },
    },
  },
} as const;

// ---------- Runtime snapshot（与 agent/normalize.ts ProductRuntimeSnapshot 对齐） ----------

const uuidSchema = {
  type: "string",
  pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
} as const;

const wireSessionLabelSchema = {
  type: "string",
  pattern: "^session-[0-9a-f]{32}$",
} as const;

const sessionStateSchema = {
  type: "string",
  enum: ["reserved", "running", "paused", "releasing", "released", "terminated"],
} as const;

const sessionPhaseSchema = {
  type: "string",
  enum: [
    "requested",
    "provisioning",
    "binding",
    "leased",
    "starting",
    "running",
    "stopping",
    "released",
    "failed",
  ],
} as const;

export const productSessionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label", "state", "phase", "outputs", "inputs"],
  properties: {
    id: uuidSchema,
    label: wireSessionLabelSchema,
    state: sessionStateSchema,
    phase: sessionPhaseSchema,
    outputs: { type: "array", items: { type: "string" } },
    inputs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "handle"],
        properties: {
          id: { type: "string" },
          handle: { type: "integer", minimum: 0 },
        },
      },
    },
  },
} as const;

export const runtimeSnapshotSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "devices",
    "ports",
    "resources",
    "sessions",
    "capabilities",
    "program_switch",
    "generated_at_ms",
    "observation_revision",
    "observation_lineage",
  ],
  properties: {
    devices: { type: "array", items: { type: "object", additionalProperties: true } },
    ports: { type: "array", items: { type: "object", additionalProperties: true } },
    resources: { type: "array", items: { type: "object", additionalProperties: true } },
    sessions: { type: "array", items: productSessionSchema },
    capabilities: { type: "array", items: { type: "object", additionalProperties: true } },
    program_switch: { type: ["object", "null"], additionalProperties: true },
    generated_at_ms: { type: "integer", minimum: 0 },
    observation_revision: { type: "integer", minimum: 0 },
    observation_lineage: { type: "string" },
  },
} as const;

// ---------- Command operation body（与 commandService.operationBody 对齐） ----------

export const commandStateSchema = {
  type: "string",
  enum: ["pending", "completed", "failed", "timeout", "conflict", "rejected"],
} as const;

export const commandOperationBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["command_id", "state", "kind", "created_at"],
  properties: {
    command_id: uuidSchema,
    state: commandStateSchema,
    kind: { type: "string", enum: ["start_session", "stop_session", "release_session"] },
    created_at: { type: "string", format: "date-time" },
    classification: { type: "string" },
    detail: { type: "string" },
    verdict: { type: "object", additionalProperties: true },
    terminal_at: { type: "string", format: "date-time" },
  },
} as const;

// ---------- Request bodies（POST 命令） ----------

/**
 * GraphRuntimeIntent —— Rust `services/media-agent/src/graph_intent.rs` 冻结
 * wire 的 Product JSON Schema 表达（SDK-01A · Debt A 清偿；BMD BUG-F 实证
 * 2026-09-29：此前的宽松 schema 允许缺 pipeline 的 intent 穿透到命令面，
 * 被真实 agent 以 invalid_intent 拒绝）。
 *
 * wire 事实来源（不发明 schema）：
 * - SourceIntent serde tagged `kind`：decklink{device_id, port_id?} /
 *   rtmp{source_id, endpoint{protocol:"rtmp", host, port, path}} /
 *   self_test（kind only，无负载字段）；
 * - SinkIntent = { kind }，词表 appsink/hls/rtmp —— pipeline.rs
 *   `pipeline_rt_01_sink_kind_vocabulary_snapshot` 受纳词表（fail-closed）；
 * - vendor-neutral 红线：additionalProperties:false 全层收紧（device_number/
 *   handle/媒体进程 argv 等执行细节字段 400 拒绝，见 VENDOR_NEUTRALITY_RULES #3）。
 */
const uuidPattern = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";

export const graphRuntimeIntentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["version", "devices"],
  properties: {
    version: { type: "string", minLength: 1 },
    devices: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["device_id", "role", "pipeline"],
        properties: {
          device_id: { type: "string", pattern: uuidPattern },
          role: { type: "string", minLength: 1 },
          pipeline: {
            type: "object",
            additionalProperties: false,
            required: ["source", "sink"],
            properties: {
              source: {
                anyOf: [
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["kind", "device_id"],
                    properties: {
                      kind: { type: "string", const: "decklink" },
                      device_id: { type: "string", pattern: uuidPattern },
                      port_id: { type: "string", pattern: uuidPattern },
                    },
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["kind", "source_id", "endpoint"],
                    properties: {
                      kind: { type: "string", const: "rtmp" },
                      source_id: { type: "string", pattern: uuidPattern },
                      endpoint: {
                        type: "object",
                        additionalProperties: false,
                        required: ["protocol", "host", "port", "path"],
                        properties: {
                          protocol: { type: "string", enum: ["rtmp"] },
                          host: { type: "string", minLength: 1 },
                          port: { type: "integer", minimum: 1, maximum: 65535 },
                          path: { type: "string", minLength: 1 },
                        },
                      },
                    },
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["kind"],
                    properties: {
                      kind: { type: "string", const: "self_test" },
                    },
                  },
                ],
              },
              sink: {
                type: "object",
                additionalProperties: false,
                required: ["kind"],
                properties: {
                  kind: { type: "string", enum: ["appsink", "hls", "rtmp"] },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const startSessionBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["intent"],
  properties: {
    intent: graphRuntimeIntentSchema,
    command_id: { type: "string", minLength: 1, maxLength: 256 },
  },
} as const;

export const sessionActionBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    command_id: { type: "string", minLength: 1, maxLength: 256 },
  },
} as const;

// ---------- Health layered view ----------

const healthLayerSchema = {
  type: "object",
  additionalProperties: true,
  required: ["status"],
  properties: {
    status: {
      type: "string",
      enum: [
        "up",
        "down",
        "unreachable",
        "not_configured",
        "running",
        "locked_by_other_instance",
        "stopped",
        "not_started",
      ],
    },
    observed_at_ms: { type: "integer", minimum: 0 },
  },
} as const;

export const healthLayersSchema = {
  type: "object",
  additionalProperties: false,
  required: ["checked_at_ms", "layers"],
  properties: {
    checked_at_ms: { type: "integer", minimum: 0 },
    layers: {
      type: "object",
      additionalProperties: false,
      required: ["api", "runtime", "db", "auth", "events"],
      properties: {
        api: healthLayerSchema,
        runtime: healthLayerSchema,
        db: healthLayerSchema,
        auth: healthLayerSchema,
        events: healthLayerSchema,
      },
    },
  },
} as const;

export const healthLiveSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status"],
  properties: {
    status: { type: "string", enum: ["live"] },
  },
} as const;

// ---------- Route 集中表（Fastify schema 入口） ----------

/**
 * 路由 schema 集中表。Fastify 在 register 时引用本表的 schema 块做请求校验
 * （body/params/querystring）；响应 shape 由同名 `RESPONSE_*` 常量作为契约
 * 文档供 Web Console 类型派生与契约测试消费，不强制附加给 Fastify 路由——
 * Fastify 默认对响应严格序列化且会因测试 stub 缺字段抛 500（这与契约目的
 * 无关），由本表 RESPONSE_* 形状独立验证（routes.schema.contract.test.ts）。
 *
 * 命名格式：`{METHOD} {PATH}` -> FastifySchema（仅请求侧）。
 * SSE 流式响应：Fastify schema 对流不生效；SSE 帧格式独立消费（`sseFramePayloadSchema`）。
 */
export interface RouteSchemaEntry {
  method: "GET" | "POST";
  url: string;
  /** Fastify 应用 schema（仅请求侧：body/params/querystring）。 */
  schema: FastifySchema;
  /** 响应 shape（契约文档；Fastify 不强制）。 */
  response: Record<string, unknown>;
}

const runtimeGetRequest: FastifySchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      session_id: uuidSchema,
    },
  },
};

const healthLiveGetRequest: FastifySchema = {};

const healthzGetRequest: FastifySchema = {};

const startSessionPostRequest: FastifySchema = {
  body: startSessionBodySchema,
};

const sessionActionPostRequest: FastifySchema = {
  params: {
    type: "object",
    additionalProperties: false,
    required: ["id"],
    properties: { id: uuidSchema },
  },
  body: sessionActionBodySchema,
};

const commandGetRequest: FastifySchema = {
  params: {
    type: "object",
    additionalProperties: false,
    required: ["id"],
    properties: { id: { type: "string", minLength: 1, maxLength: 256 } },
  },
};

const eventsStreamGetRequest: FastifySchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      cursor: { type: "string", pattern: "^\\d{1,19}$" },
    },
  },
};

/** 响应 shape（契约文档）—— 完整 status-code → envelope。 */
const runtimeResponses = {
  200: runtimeSnapshotSchema,
  400: errorEnvelopeSchema,
  404: errorEnvelopeSchema,
  401: errorEnvelopeSchema,
  403: errorEnvelopeSchema,
  429: errorEnvelopeSchema,
  500: errorEnvelopeSchema,
  503: errorEnvelopeSchema,
} as const;

const healthLiveResponses = { 200: healthLiveSchema } as const;
const healthzResponses = { 200: healthLayersSchema } as const;

const commandResponses = {
  200: commandOperationBodySchema,
  400: errorEnvelopeSchema,
  401: errorEnvelopeSchema,
  403: errorEnvelopeSchema,
  404: errorEnvelopeSchema,
  409: errorEnvelopeSchema,
  429: errorEnvelopeSchema,
  500: errorEnvelopeSchema,
  503: errorEnvelopeSchema,
} as const;

const eventsResponses = {
  401: errorEnvelopeSchema,
  403: errorEnvelopeSchema,
  429: errorEnvelopeSchema,
  500: errorEnvelopeSchema,
  503: errorEnvelopeSchema,
} as const;

export const ROUTE_SCHEMAS: readonly RouteSchemaEntry[] = [
  {
    method: "GET",
    url: "/api/v1/runtime",
    schema: runtimeGetRequest,
    response: runtimeResponses as unknown as Record<string, unknown>,
  },
  {
    method: "GET",
    url: "/health/live",
    schema: healthLiveGetRequest,
    response: healthLiveResponses as unknown as Record<string, unknown>,
  },
  {
    method: "GET",
    url: "/healthz",
    schema: healthzGetRequest,
    response: healthzResponses as unknown as Record<string, unknown>,
  },
  {
    method: "POST",
    url: "/api/v1/sessions",
    schema: startSessionPostRequest,
    response: commandResponses as unknown as Record<string, unknown>,
  },
  {
    method: "POST",
    url: "/api/v1/sessions/:id/stop",
    schema: sessionActionPostRequest,
    response: commandResponses as unknown as Record<string, unknown>,
  },
  {
    method: "POST",
    url: "/api/v1/sessions/:id/release",
    schema: sessionActionPostRequest,
    response: commandResponses as unknown as Record<string, unknown>,
  },
  {
    method: "GET",
    url: "/api/v1/commands/:id",
    schema: commandGetRequest,
    response: commandResponses as unknown as Record<string, unknown>,
  },
  {
    method: "GET",
    url: "/events/v1/stream",
    schema: eventsStreamGetRequest,
    response: eventsResponses as unknown as Record<string, unknown>,
  },
] as const;

// ---------- SSE 帧 shape（Web Console parser 用；Fastify schema 对流式响应不生效） ----------

export const sseFramePayloadSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sequence", "observed_at_ms", "weak_ordering", "snapshot"],
  properties: {
    sequence: { type: "integer", minimum: 0 },
    observed_at_ms: { type: "integer", minimum: 0 },
    weak_ordering: { type: "boolean", const: true },
    snapshot: { type: "object", additionalProperties: true },
  },
} as const;
