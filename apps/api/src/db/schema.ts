/**
 * CP-01B durable command boundary（RH-IDEM-01 清偿）+ CP-01C authn/authz/audit
 * hardening。
 *
 * 表族对齐 CONTROL-PLANE-ENTRY-01 planning §5 与 V0.2 §5 命名族：
 * - `commands` = 外部 boundary-of-record（durable idempotency + 命令旅程）；
 * - `audit_entries` = 安全/命令审计（who/what/when/command_id/verdict/
 *   authorization decision；CP-01C 扩展为通用安全审计面，与 V0.2 §5 通用
 *   `audit_logs` 家族的 CP 专属 reconciliation——收口报告记录命名裁定）；
 * - `event_outbox` = CP-01D External Event 投影投递缓冲（planning §5/C7；
 *   sequence = SSE cursor；outbox 是投递事实，**绝不**是 Runtime truth）；
 * - Better Auth identity 族（auth_user/auth_session/auth_account/
 *   auth_verification）+ `api_keys`（Better Auth api-key plugin 官方模型，
 *   表名对齐 V0.2 §5 `api_keys` 家族——收口报告记录该命名裁定）。
 *
 * 红线（C6/C8/C10）：state 单向迁移（claimed→终态，条件 UPDATE）；
 * 终态不可变、无覆写路径；Fastify 从不读 agent 幂等表；这些表是命令旅程/
 * 安全审计事实，**绝不**成为 session/resource/health 的 Runtime truth。
 * API key secret 只以库内 SHA-256 摘要形态持久化，明文永不落库/落日志/落审计。
 */
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** C8 冻结词表：pending（claimed 未终态）/ completed / failed / timeout / conflict / rejected。 */
export const commandState = pgEnum("command_state", [
  "pending",
  "completed",
  "failed",
  "timeout",
  "conflict",
  "rejected",
]);

export const commands = pgTable(
  "commands",
  {
    commandId: uuid("command_id").primaryKey(),
    /** 认证主体（CP-01C = Better Auth user id；fingerprint 组成部分·C6）。 */
    principal: text("principal").notNull(),
    kind: text("kind").notNull(),
    /** canonical target JSON（fingerprint 输入，排除 issued_at/requested_by·D9-A）。 */
    target: jsonb("target").notNull(),
    /** sha256(kind + canonical target + principal)——同键异 fingerprint = Conflict。 */
    fingerprint: text("fingerprint").notNull(),
    state: commandState("state").notNull().default("pending"),
    /** agent 裁决原样（ApiCommandResponse）——终态时写入，不可变。 */
    verdict: jsonb("verdict"),
    classification: text("classification"),
    detail: text("detail"),
    /** 首次终态响应的 HTTP 状态与响应体（F3 逐字节重放语义）。 */
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    terminalAt: timestamp("terminal_at", { withTimezone: true }),
  },
  (t) => [
    index("commands_state_created_idx").on(t.state, t.createdAt),
  ],
);

/**
 * 安全/命令审计（C10/C11）。CP-01C 扩展：每条记录覆盖
 * who（principal/role）/ what（action）/ when（at）/ command_id（贯穿链）/
 * verdict（state/classification）/ authorization decision（decision/reason）。
 * 命令审计与命令终态同事务写入；拒绝路径（authn/authz/rate-limit）审计
 * command_id 为 NULL（拒绝不占幂等·C4）。detail 永不含 credential/secret。
 */
export const auditEntries = pgTable(
  "audit_entries",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    /** who：认证主体 id；未认证尝试记 "anonymous"。 */
    principal: text("principal").notNull(),
    /** 决策时主体角色（未知/缺失为 NULL——fail-closed 语义由 authz 层保证）。 */
    role: text("role"),
    /** what：Product API 语义动作（session.start…）或安全事件（auth.reject…）。 */
    action: text("action").notNull(),
    /** authorization decision：allowed | denied。 */
    decision: text("decision").notNull(),
    /** 拒绝原因机读码（auth.missing_credentials / authz.denied / ratelimit…）。 */
    reason: text("reason"),
    commandId: uuid("command_id"),
    /** 命令审计的终态（与 commands.state 同事务写入）；非命令事件为 NULL。 */
    state: commandState("state"),
    classification: text("classification"),
    detail: jsonb("detail"),
  },
  (t) => [
    uniqueIndex("audit_entries_command_id_key").on(t.commandId),
    index("audit_entries_at_idx").on(t.at),
    index("audit_entries_principal_at_idx").on(t.principal, t.at),
  ],
);

/**
 * CP-01D Event plane 持久投递缓冲（planning §5 `event_outbox`）。每行 =
 * 一次 `events.projection` drain 的聚合投影快照（RuntimeEvent 原文不出
 * agent——wire 只给聚合，F10 弱序如实标注）。`sequence`（bigserial 单调）
 * = SSE cursor 与 consumer 幂等键（F9：重放 at-least-once，consumer 以
 * sequence 去重）。投递边界诚实披露：agent drain 是破坏性读、无 ack，
 * drain 与 outbox 插入非跨进程原子——Fastify 崩溃窗口内的投影样本会丢失
 * （bounded packet 如实登记，不冒充 exactly-once）。
 */
export const eventOutbox = pgTable(
  "event_outbox",
  {
    sequence: bigserial("sequence", { mode: "number" }).primaryKey(),
    /** 投影观测时间（drain 完成时刻）。 */
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
    /** agent `events.projection` 聚合投影快照原样（守门字段在传输层已校验）。 */
    snapshot: jsonb("snapshot").notNull(),
  },
  (t) => [index("event_outbox_observed_at_idx").on(t.observedAt)],
);

// ---------------------------------------------------------------------------
// Better Auth identity 族（CP-01C）。字段名（TS 侧）必须与 Better Auth 官方
// schema 一致（drizzle adapter 按 model name 映射）；DB 列名按本仓 snake_case
// 惯例。Better Auth 是 AuthN identity owner；这些表不是 Runtime truth（C10）。
// ---------------------------------------------------------------------------

/** Better Auth core `user` 模型 + CP-01C `role` additional field（RBAC 输入）。 */
export const authUser = pgTable(
  "auth_user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull(),
    image: text("image"),
    /** CP-01C RBAC 角色（viewer|operator）；NULL/未知角色 fail-closed 全拒绝。 */
    role: text("role"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("auth_user_role_idx").on(t.role)],
);

export const authSession = pgTable(
  "auth_session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
  },
  (t) => [index("auth_session_user_id_idx").on(t.userId)],
);

export const authAccount = pgTable(
  "auth_account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("auth_account_user_id_idx").on(t.userId)],
);

export const authVerification = pgTable("auth_verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

/**
 * Better Auth api-key plugin 官方模型（model `apikey`），表名对齐 V0.2 §5
 * `api_keys` 家族。`key` 列 = 库内 SHA-256 摘要（base64url，无盐）——明文
 * secret 永不持久化；`start` 列是官方设计的前缀标识（非 secret，供运营
 * 识别）。revoke = `enabled=false`；expire = `expires_at`（过期行由插件
 * 验证路径删除并拒绝）。
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    /** Better Auth api-key plugin 配置组 id（本仓单配置组 = "default"）。 */
    configId: text("config_id").notNull().default("default"),
    name: text("name"),
    start: text("start"),
    /** key 属主（references="user" 语义）= auth_user.id。 */
    referenceId: text("reference_id").notNull(),
    prefix: text("prefix"),
    key: text("key").notNull(),
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: timestamp("last_refill_at", { withTimezone: true }),
    enabled: boolean("enabled").default(true),
    rateLimitEnabled: boolean("rate_limit_enabled").default(true),
    rateLimitTimeWindow: integer("rate_limit_time_window"),
    rateLimitMax: integer("rate_limit_max"),
    requestCount: integer("request_count").default(0),
    remaining: integer("remaining"),
    lastRequest: timestamp("last_request", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    permissions: text("permissions"),
    metadata: text("metadata"),
  },
  (t) => [
    index("api_keys_key_idx").on(t.key),
    index("api_keys_reference_id_idx").on(t.referenceId),
    index("api_keys_config_id_idx").on(t.configId),
  ],
);

// ---------------------------------------------------------------------------
// alarms（HEALTH-INCIDENT-ENTRY-01 HI-01A）。
//
// Alarm = **投影层派生事实**（drain 点从 agent faults 摘要块折叠），不是
// Runtime truth——媒体生命周期/恢复决策归 Runtime/Supervisor/canonical
// command（红线：本表无任何写回 Runtime 的路径）。operator ACK 仅是
// awareness state（ack_at/ack_by/ack_note 三字段），绝不解释为 Runtime
// healthy 或故障消失。recovery_status 由投影层从事件序列机械推断
// （规则见 alarms/alarmProjection.ts，判定输入存 evidence 可审计）。
// ---------------------------------------------------------------------------

/** 派生严重级（机械映射：retryable pipeline fault=warning，其余 fault=error）。 */
export const alarmSeverity = pgEnum("alarm_severity", ["warning", "error"]);

/** 投影层恢复状态推断（active=未清；escalating=backoff 窗口内复发；recovered=清）。 */
export const alarmRecovery = pgEnum("alarm_recovery_status", [
  "active",
  "escalating",
  "recovered",
]);

export const alarms = pgTable(
  "alarms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 派生去重键：kind + failure_domain + related 主标识。 */
    fingerprint: text("fingerprint").notNull(),
    severity: alarmSeverity("severity").notNull(),
    /** 触发事件 kind（fault 词表，canonical）。 */
    kind: text("kind").notNull(),
    /** 失败域（source|pipeline|hardware|identity|session|resource 机械映射）。 */
    failureDomain: text("failure_domain").notNull(),
    relatedSessionId: uuid("related_session_id"),
    relatedDeviceId: uuid("related_device_id"),
    relatedPipelineId: uuid("related_pipeline_id"),
    /** 事件 summary/reason 原文（canonical，不翻译）。 */
    summary: text("summary").notNull(),
    /** PipelineFault retryable；其余 kind null。 */
    retryable: boolean("retryable"),
    recoveryStatus: alarmRecovery("recovery_status").notNull().default("active"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    /** 同 fingerprint 复发计数（含首次）。 */
    eventCount: integer("event_count").notNull().default(1),
    active: boolean("active").notNull().default(true),
    clearedAt: timestamp("cleared_at", { withTimezone: true }),
    /** cleared=恢复事件驱动 | superseded=同 fingerprint 新行接管（登记用）。 */
    clearReason: text("clear_reason"),
    /** 判定输入快照（触发 fault digest + clear/复发判定依据；审计用）。 */
    evidence: jsonb("evidence").notNull(),
    // ACK = operator awareness only（红线：不改变 active/恢复状态）。
    ackAt: timestamp("ack_at", { withTimezone: true }),
    ackBy: text("ack_by"),
    ackNote: text("ack_note"),
  },
  (t) => [
    // Partial unique：同 fingerprint 至多一行 active（cleared 历史行不受约束，
    // 复发重开为新行，历史保留）。
    uniqueIndex("alarms_fingerprint_active_idx")
      .on(t.fingerprint)
      .where(sql`${t.active}`),
    index("alarms_active_idx").on(t.active),
    index("alarms_last_seen_idx").on(t.lastSeenAt),
  ],
);
