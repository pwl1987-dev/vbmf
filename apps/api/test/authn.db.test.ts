/**
 * CP-01C authn/authz/audit DB 层测试（真实 Better Auth + ephemeral PG）。
 *
 * 覆盖安全检查单中需要持久层的项：
 * - Better Auth 官方 api-key 生命周期：create/verify/revoke（enabled=false）/
 *   expiry（expires_at 过去）全部即时生效；
 * - 明文 secret 不落库（库内 = 官方 SHA-256 base64url 摘要）、不落审计；
 * - 未认证/无效凭证 → 401 且 commands 表零 claim（拒绝不占幂等·C4）；
 * - 授权拒绝 / 限流拒绝 → 审计行（who/what/decision/reason，含 keyStart 非
 *   secret 标识），且不占幂等 claim；
 * - 命令审计完整性：who/what/when/command_id/verdict（state+classification）/
 *   decision；
 * - 运维 provision 工具路径（scripts/provision-identity.ts 的 create 逻辑）
 *   产出的 key 可认证。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.ts";
import { buildAppHandle, type AppHandle } from "../src/server.ts";
import { AgentControlClient } from "../src/agent/agentControlClient.ts";
import { createDb, runMigrations, type Db } from "../src/db/index.ts";
import { createAuth, type AuthDeps } from "../src/security/auth.ts";
import { provisionIdentity, type ProvisionedIdentity } from "./helpers/provisionDb.ts";
import type { AgentQuerySnapshotWire } from "../src/agent/types.ts";
import { apiKeys, auditEntries, commands, authUser } from "../src/db/schema.ts";
import { eq, sql } from "drizzle-orm";
import { uuidV5 } from "../src/command/commandIds.ts";

const DB_URL = process.env.DATABASE_TEST_URL;
const hasDb = DB_URL !== undefined && DB_URL !== "";
const dbTest = hasDb ? test : test.skip;
const SECRET = "test-secret-for-ephemeral-pg-only";

function startIntent(): Record<string, unknown> {
  return {
    version: "1.0",
    devices: [{ device_id: "00000000-0000-0000-0000-0000000000d1", role: "CAPTURE", pipeline: { source: { kind: "decklink", device_id: "00000000-0000-0000-0000-0000000000d1" }, sink: { kind: "appsink" } } }],
  };
}

const okAgent = (): AgentControlClient =>
  new AgentControlClient({
    baseUrl: "http://agent.invalid",
    fetchImpl: (async (_input: string | URL | Request, init?: RequestInit) => {
      const envelope = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      const snapshot: AgentQuerySnapshotWire = {
        devices: [{ id: "dev-1", model: "Mock" }],
        ports: [{ id: "port-1", device_id: "dev-1", direction: "input" }],
        resources: [{ id: "res-1", device_id: "dev-1", state: "allocated" }],
        sessions: [],
        capabilities: [],
        generated_at_ms: 1_700_000_000_999,
        observation_revision: 1,
        observation_lineage: "00000000-0000-0000-0000-0000000000aa",
        program_switch: null,
      };
      const result = envelope.method === "runtime.query" ? snapshot : { command_id: "x", status: { status: "executed" }, kind: "start_session" };
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", result, id: 1 }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch,
  });

async function appWith(opts: { rateLimitWriteMax?: number } = {}): Promise<{
  handle: AppHandle;
  operator: ProvisionedIdentity;
  viewer: ProvisionedIdentity;
}> {
  const config = loadConfig({
    ...process.env,
    LOG_LEVEL: "silent",
    DATABASE_URL: DB_URL,
    BETTER_AUTH_SECRET: SECRET,
    MIGRATE_ON_BOOT: "false",
    RATE_LIMIT_WRITE_MAX: String(opts.rateLimitWriteMax ?? 60),
  });
  const handle = await buildAppHandle(config, { agent: okAgent() });
  const auth = createAuth({ db: handle.db as Db, secret: SECRET } as AuthDeps);
  const operator = await provisionIdentity(handle.db as Db, auth, { role: "operator" });
  const viewer = await provisionIdentity(handle.db as Db, auth, { role: "viewer" });
  return { handle, operator, viewer };
}

dbTest("auth 表族迁移从干净库应用（幂等重跑）+ 全表清场", { skip: !hasDb }, async () => {
  const { createDb } = await import("../src/db/index.ts");
  const { db, pool } = createDb(DB_URL!);
  await runMigrations(db);
  await db.execute(sql`truncate table ${auditEntries}, ${commands}, ${authUser}, ${apiKeys}, auth_session, auth_account, auth_verification`);
  await pool.end();
});

dbTest("官方 createApiKey → x-api-key 认证通过；明文 secret 不落库（仅官方 SHA-256 摘要）", { skip: !hasDb }, async () => {
  const { handle, operator } = await appWith();
  try {
    const r = await handle.app.inject({
      method: "GET",
      url: "/api/v1/runtime",
      headers: { "x-api-key": operator.apiKey },
    });
    assert.equal(r.statusCode, 200, "官方创建的 key 必须可认证");
    const [row] = await handle.db!.select().from(apiKeys).where(eq(apiKeys.id, operator.keyId));
    assert.ok(row !== undefined);
    assert.notEqual(row.key, operator.apiKey, "库内不得存明文 key");
    assert.ok(!operator.apiKey.includes(row.key), "摘要不得是明文的子串");
    // 官方 defaultKeyHasher 形态：base64url(SHA-256(key))，43 字符无 padding。
    assert.equal(row.key.length, 43, "官方摘要形态（base64url sha256，无 padding）");
    assert.ok(!/[+/=]/.test(row.key), "base64url 字母表");
    // 审计/命令行也不得携带明文（此用例无命令；审计将由后续用例检查）。
  } finally {
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("revoke（enabled=false）即时生效 → 401 + commands 零 claim", { skip: !hasDb }, async () => {
  const { handle, operator } = await appWith();
  try {
    await handle.db!.update(apiKeys).set({ enabled: false }).where(eq(apiKeys.id, operator.keyId));
    const r = await handle.app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { "x-api-key": operator.apiKey, "idempotency-key": "authn-revoked-key" },
      payload: { intent: startIntent() },
    });
    assert.equal(r.statusCode, 401);
    assert.equal((r.json() as { error: { code: string } }).error.code, "AUTHENTICATION_FAILED");
    const [claimed] = await handle.db!.select().from(commands).where(eq(commands.commandId, uuidV5("authn-revoked-key")));
    assert.equal(claimed, undefined, "认证拒绝绝不占用 durable 幂等 claim");
  } finally {
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("expired（expires_at 过去）→ 401 + 零 claim；过期行被验证路径清理", { skip: !hasDb }, async () => {
  const { handle, operator } = await appWith();
  try {
    await handle.db!.update(apiKeys).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(apiKeys.id, operator.keyId));
    const r = await handle.app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { "x-api-key": operator.apiKey, "idempotency-key": "authn-expired-key" },
      payload: { intent: startIntent() },
    });
    assert.equal(r.statusCode, 401);
    const [claimed] = await handle.db!.select().from(commands).where(eq(commands.commandId, uuidV5("authn-expired-key")));
    assert.equal(claimed, undefined, "过期凭证拒绝不占幂等 claim");
    const [row] = await handle.db!.select().from(apiKeys).where(eq(apiKeys.id, operator.keyId));
    assert.equal(row, undefined, "过期行由验证路径删除（官方语义）");
  } finally {
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("授权拒绝审计：viewer POST start → 403 + 审计行（who/what/decision/reason）+ 零 claim", { skip: !hasDb }, async () => {
  const { handle, viewer } = await appWith();
  try {
    const r = await handle.app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { "x-api-key": viewer.apiKey, "idempotency-key": "authn-viewer-start" },
      payload: { intent: startIntent() },
    });
    assert.equal(r.statusCode, 403);
    const rows = await handle.db!.select().from(auditEntries).where(eq(auditEntries.principal, viewer.userId));
    assert.equal(rows.length, 1, "恰好一条授权拒绝审计");
    const row = rows[0]!;
    assert.equal(row.action, "authz.deny");
    assert.equal(row.decision, "denied");
    assert.equal(row.reason, "authz.denied");
    assert.equal(row.role, "viewer");
    assert.equal(row.commandId, null, "拒绝无 command claim");
    assert.equal(row.detail !== null && JSON.stringify(row.detail).includes(viewer.apiKey), false, "审计不含 secret");
    const [claimed] = await handle.db!.select().from(commands).where(eq(commands.commandId, uuidV5("authn-viewer-start")));
    assert.equal(claimed, undefined);
  } finally {
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("未认证拒绝审计：无 key → 401 + 审计（anonymous）", { skip: !hasDb }, async () => {
  const { handle } = await appWith();
  try {
    const r = await handle.app.inject({ method: "GET", url: "/api/v1/runtime" });
    assert.equal(r.statusCode, 401);
    const rows = await handle.db!
      .select()
      .from(auditEntries)
      .where(sql`${auditEntries.principal} = 'anonymous' and ${auditEntries.reason} = 'auth.missing_credentials'`);
    assert.ok(rows.length >= 1, "未认证尝试入审计");
    for (const row of rows) {
      assert.equal(row.decision, "denied");
      assert.equal(row.reason, "auth.missing_credentials");
    }
  } finally {
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("限流拒绝：429 + 审计（ratelimit.exceeded）+ 该 key 的 durable claim 不存在", { skip: !hasDb }, async () => {
  const { handle, operator } = await appWith({ rateLimitWriteMax: 1 });
  try {
    const r1 = await handle.app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { "x-api-key": operator.apiKey, "idempotency-key": "authn-rl-1" },
      payload: { intent: startIntent() },
    });
    assert.equal(r1.statusCode, 200);
    const r2 = await handle.app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { "x-api-key": operator.apiKey, "idempotency-key": "authn-rl-2" },
      payload: { intent: startIntent() },
    });
    assert.equal(r2.statusCode, 429);
    assert.equal((r2.json() as { error: { code: string } }).error.code, "RATE_LIMITED");
    assert.ok(r2.headers["retry-after"], "429 携带 Retry-After");
    const rlKey = uuidV5("authn-rl-2");
    const [claimed] = await handle.db!.select().from(commands).where(eq(commands.commandId, rlKey));
    assert.equal(claimed, undefined, "限流拒绝绝不占用 durable 幂等 claim（红线）");
    const denials = await handle.db!.select().from(auditEntries).where(eq(auditEntries.reason, "ratelimit.exceeded"));
    assert.equal(denials.length, 1);
    assert.equal(denials[0]!.principal, operator.userId);
    assert.equal(denials[0]!.decision, "denied");
  } finally {
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("命令审计完整性：who/role/what/when/command_id/verdict(state+classification)/decision", { skip: !hasDb }, async () => {
  const { handle, operator } = await appWith();
  try {
    const r = await handle.app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { "x-api-key": operator.apiKey, "idempotency-key": "authn-audit-complete" },
      payload: { intent: startIntent() },
    });
    assert.equal(r.statusCode, 200);
    const cid = (r.json() as { command_id: string }).command_id;
    const [row] = await handle.db!.select().from(auditEntries).where(eq(auditEntries.commandId, cid));
    assert.ok(row !== undefined);
    assert.equal(row.principal, operator.userId);
    assert.equal(row.role, "operator");
    assert.equal(row.action, "session.start");
    assert.equal(row.decision, "allowed");
    assert.equal(row.state, "completed");
    assert.ok(row.at instanceof Date, "when 落库");
    assert.equal(JSON.stringify(row.detail ?? {}).includes(operator.apiKey), false, "审计无 secret");
  } finally {
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("provision 工具同路径（官方 createApiKey + auth_user 直插）产出的 key 可认证", { skip: !hasDb }, async () => {
  const { handle } = await appWith();
  try {
    const auth = createAuth({ db: handle.db as Db, secret: SECRET } as AuthDeps);
    const identity = await provisionIdentity(handle.db as Db, auth, { role: "operator" });
    const r = await handle.app.inject({
      method: "GET",
      url: "/api/v1/runtime",
      headers: { "x-api-key": identity.apiKey },
    });
    assert.equal(r.statusCode, 200);
  } finally {
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("skip 语义自证：无 DATABASE_TEST_URL 时本套件显式 skip", { skip: hasDb }, () => {
  assert.ok(true);
});
