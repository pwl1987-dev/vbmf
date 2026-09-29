/**
 * CP-01B durable command F1–F8 注入测试（CP-01C 升级：真实 Better Auth
 * identity 参与 principal/fingerprint/audit）——需要真实 PostgreSQL
 * （planning §8：PG ephemeral 实例跑迁移与并发/崩溃注入）。
 *
 * 运行：`DATABASE_TEST_URL=postgres://… npm run test:db`（Dev VM 用
 * ephemeral docker postgres，每次运行新实例避免历史行干扰）。CI lane 保持
 * 无 DB hermetic —— 本文件在 DATABASE_TEST_URL 缺省时整文件 skip（显式
 * 计数，绝不静默假绿）。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.ts";
import { buildAppHandle, type AppHandle } from "../src/server.ts";
import { AgentControlClient, AgentTransportFailure } from "../src/agent/agentControlClient.ts";
import { createDb, runMigrations, type Db } from "../src/db/index.ts";
import { createAuth, type AuthDeps } from "../src/security/auth.ts";
import { provisionIdentity, type ProvisionedIdentity } from "./helpers/provisionDb.ts";
import { auditEntries, commands } from "../src/db/schema.ts";
import { eq, sql } from "drizzle-orm";
import { commandFingerprint } from "../src/command/fingerprint.ts";
import { uuidV5 } from "../src/command/commandIds.ts";

const DB_URL = process.env.DATABASE_TEST_URL;
const hasDb = DB_URL !== undefined && DB_URL !== "";
const dbTest = hasDb ? test : test.skip;

interface RecordedDispatch {
  command_id: string;
  kind: string;
  target: Record<string, unknown>;
  requested_by?: string;
}

/** 可编程 mock agent：记录 dispatch 调用；可注入延迟/失败/自定义裁决。 */
class MockAgent {
  readonly dispatches: RecordedDispatch[] = [];
  verdict: unknown = { command_id: "x", status: { status: "executed" }, kind: "start_session" };
  delayMs = 0;
  fail = false;
  readonly client: AgentControlClient;

  constructor() {
    this.client = new AgentControlClient({
      baseUrl: "http://agent.invalid",
      fetchImpl: (async (_input: string | URL | Request, init?: RequestInit) => {
        const envelope = JSON.parse(String(init?.body ?? "{}")) as {
          method?: string;
          params?: RecordedDispatch;
        };
        if (envelope.method === "command.dispatch" && envelope.params !== undefined) {
          this.dispatches.push(envelope.params);
        }
        await new Promise((r) => setTimeout(r, this.delayMs));
        if (this.fail) throw new AgentTransportFailure("network", "mock injected failure");
        return new Response(JSON.stringify({ jsonrpc: "2.0", result: this.verdict, id: 1 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch,
    });
  }
}

function startIntent(): Record<string, unknown> {
  return {
    version: "1.0",
    devices: [{ device_id: "00000000-0000-0000-0000-0000000000d1", role: "CAPTURE", pipeline: { source: { kind: "decklink", device_id: "00000000-0000-0000-0000-0000000000d1" }, sink: { kind: "appsink" } } }],
  };
}

interface Fixture {
  handle: AppHandle;
  operator: ProvisionedIdentity;
  viewer: ProvisionedIdentity;
  otherOperator: ProvisionedIdentity;
}

async function appWith(
  mock: MockAgent,
  extra: { leaseMs?: number; replayWaitMs?: number } = {},
): Promise<Fixture> {
  const config = loadConfig({
    ...process.env,
    LOG_LEVEL: "silent",
    DATABASE_URL: DB_URL,
    BETTER_AUTH_SECRET: "test-secret-for-ephemeral-pg-only",
    MIGRATE_ON_BOOT: "false",
    COMMAND_LEASE_MS: String(extra.leaseMs ?? 30_000),
    COMMAND_REPLAY_WAIT_MS: String(extra.replayWaitMs ?? 800),
  });
  const handle = await buildAppHandle(config, { agent: mock.client });
  // 与 buildAppHandle 相同 db/secret 的独立 auth 实例，用于官方 provisioning。
  const auth = createAuth({ db: handle.db as Db, secret: "test-secret-for-ephemeral-pg-only" } as AuthDeps);
  const operator = await provisionIdentity(handle.db as Db, auth, { role: "operator" });
  const viewer = await provisionIdentity(handle.db as Db, auth, { role: "viewer" });
  const otherOperator = await provisionIdentity(handle.db as Db, auth, { role: "operator" });
  return { handle, operator, viewer, otherOperator };
}

function post(
  handle: AppHandle,
  key: string,
  payload: object,
  extraHeaders: Record<string, string> = {},
) {
  return handle.app.inject({
    method: "POST",
    url: "/api/v1/sessions",
    headers: { "idempotency-key": key, ...extraHeaders },
    payload,
  });
}

const asOperator = (identity: ProvisionedIdentity): Record<string, string> => ({ "x-api-key": identity.apiKey });

dbTest("migrations apply on ephemeral PG + 幂等可重跑（清空命令/审计/身份表族）", { skip: !hasDb }, async () => {
  const { createDb } = await import("../src/db/index.ts");
  const { db, pool } = createDb(DB_URL!);
  await runMigrations(db);
  // 每次运行从干净面开始（同一 ephemeral 库可重复执行，无历史行干扰）。
  await db.execute(sql`truncate table ${auditEntries}, ${commands}, auth_user, api_keys, auth_session, auth_account, auth_verification`);
  await pool.end();
});

dbTest("F1: agent 停机 → 首提交 503 retryable + PG terminal timeout(retryable) + 审计；绝不假成功", async () => {
  const mock = new MockAgent();
  mock.fail = true;
  const { handle, operator } = await appWith(mock);
  try {
    const r = await post(handle, "cp01b-f1-key", { intent: startIntent() }, asOperator(operator));
    assert.equal(r.statusCode, 503);
    const err = (r.json() as unknown as { error: Record<string, unknown> }).error;
    assert.equal(err.code, "DEPENDENCY_UNAVAILABLE");
    assert.equal(err.retryable, true);
    const cid = uuidV5("cp01b-f1-key");
    const [row] = await handle.db!.select().from(commands).where(eq(commands.commandId, cid));
    assert.ok(row !== undefined, "claim 行必须存在");
    assert.equal(row.state, "timeout");
    assert.equal(row.classification, "retryable");
    assert.equal(row.principal, operator.userId, "principal = 真实认证主体 id");
    const [audit] = await handle.db!.select().from(auditEntries).where(eq(auditEntries.commandId, cid));
    assert.ok(audit !== undefined, "审计行与终态同事务落库");
    assert.equal(audit.state, "timeout");
    assert.equal(audit.principal, operator.userId);
    assert.equal(audit.role, "operator");
    assert.equal(audit.action, "session.start");
    assert.equal(audit.decision, "allowed");
  } finally {
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("F2: 依赖失败终态后重放同键 → 不自动重发（dispatch 恰一次）+ 重放首响应", async () => {
  const mock = new MockAgent();
  mock.fail = true;
  const { handle, operator } = await appWith(mock);
  try {
    const payload = { intent: startIntent() };
    const r1 = await post(handle, "cp01b-f2-key", payload, asOperator(operator));
    assert.equal(r1.statusCode, 503);
    assert.equal(mock.dispatches.length, 1, "首次提交恰好一次 dispatch 尝试");
    const r2 = await post(handle, "cp01b-f2-key", payload, asOperator(operator));
    assert.equal(r2.statusCode, 503, "重放首次终态（timeout）");
    assert.deepEqual(r2.json(), r1.json());
    assert.equal(mock.dispatches.length, 1, "重放绝不自动重发（F2 红线）");
  } finally {
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("F3: 同键同 payload 终态后重放 → 同状态码同响应体（语义级）", async () => {
  const mock = new MockAgent();
  const { handle, operator } = await appWith(mock);
  try {
    const payload = { intent: startIntent() };
    const r1 = await post(handle, "cp01b-f3-key", payload, asOperator(operator));
    assert.equal(r1.statusCode, 200);
    assert.equal(r1.json().state, "completed");
    assert.equal(mock.dispatches.length, 1);
    const r2 = await post(handle, "cp01b-f3-key", payload, asOperator(operator));
    assert.equal(r2.statusCode, 200);
    assert.deepEqual(r2.json(), r1.json(), "F3 逐字节重放首次响应体语义");
    assert.equal(mock.dispatches.length, 1, "重放不重发");
  } finally {
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("F4: 同键异 payload / 异主体（真实身份 A/B）→ 409 RESOURCE_CONFLICT；第二 payload 零执行", async () => {
  const mock = new MockAgent();
  const { handle, operator, otherOperator } = await appWith(mock);
  try {
    const r1 = await post(handle, "cp01b-f4-key", { intent: startIntent() }, asOperator(operator));
    assert.equal(r1.statusCode, 200);
    assert.equal(mock.dispatches.length, 1);
    const r2 = await post(handle, "cp01b-f4-key", {
      intent: { ...startIntent(), devices: [{ device_id: "00000000-0000-0000-0000-0000000000d2", role: "CAPTURE", pipeline: { source: { kind: "decklink", device_id: "00000000-0000-0000-0000-0000000000d2" }, sink: { kind: "appsink" } } }] },
    }, asOperator(operator));
    assert.equal(r2.statusCode, 409);
    const err = (r2.json() as unknown as { error: Record<string, unknown> }).error;
    assert.equal(err.code, "RESOURCE_CONFLICT");
    assert.equal(err.retryable, false);
    // CP-01C 核心语义：principal A 与 principal B 使用相同 Idempotency-Key
    // → fingerprint conflict（fingerprint 含真实认证主体 id）。
    const r3 = await post(handle, "cp01b-f4-key", { intent: startIntent() }, asOperator(otherOperator));
    assert.equal(r3.statusCode, 409, "同键不同真实主体 = Conflict（fingerprint 含 principal）");
    assert.equal(mock.dispatches.length, 1, "冲突 payload 绝不执行");
  } finally {
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("F5: 同键并发 → 恰一次 dispatch；并发者全部收敛到首终态", async () => {
  const mock = new MockAgent();
  mock.delayMs = 300;
  const { handle, operator } = await appWith(mock, { replayWaitMs: 2_000 });
  try {
    const payload = { intent: startIntent() };
    const responses = await Promise.all([
      post(handle, "cp01b-f5-key", payload, asOperator(operator)),
      post(handle, "cp01b-f5-key", payload, asOperator(operator)),
      post(handle, "cp01b-f5-key", payload, asOperator(operator)),
      post(handle, "cp01b-f5-key", payload, asOperator(operator)),
    ]);
    assert.equal(mock.dispatches.length, 1, "并发同 envelope 恰一次 claim/dispatch");
    for (const r of responses) {
      assert.equal(r.statusCode, 200);
      assert.equal(r.json().state, "completed");
    }
    // jsonb 存储会规范化键序——重放语义=响应体语义（C6 措辞），对象级比对。
    const first = responses[0]!.json();
    for (const r of responses.slice(1)) {
      assert.deepEqual(r.json(), first, "并发者响应一致（重放/等待后收敛）");
    }
  } finally {
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("F6: Fastify 崩溃于 dispatch 中（遗留 claim-only pending）→ 超龄租约回收 timeout(retryable)，不猜成功", async () => {
  const mock = new MockAgent();
  const { handle, operator } = await appWith(mock, { leaseMs: 200 });
  try {
    const cid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const target = { target_type: "session_by_id", session_id: cid };
    await handle.db!.insert(commands).values({
      commandId: cid,
      principal: operator.userId,
      kind: "stop_session",
      target,
      fingerprint: commandFingerprint("stop_session", target, operator.userId),
      state: "pending",
      createdAt: new Date(Date.now() - 60_000),
    });
    const res = await handle.app.inject({
      method: "GET",
      url: `/api/v1/commands/${cid}`,
      headers: asOperator(operator),
    });
    assert.equal(res.statusCode, 200);
    assert.equal((res.json() as Record<string, unknown>).state, "timeout", "超龄 pending 只能回收为 timeout");
    const [row] = await handle.db!.select().from(commands).where(eq(commands.commandId, cid));
    assert.ok(row !== undefined);
    assert.equal(row.state, "timeout");
    assert.equal(row.classification, "retryable");
    const [audit] = await handle.db!.select().from(auditEntries).where(eq(auditEntries.commandId, cid));
    assert.ok(audit !== undefined, "回收同样落审计");
    assert.equal(audit.decision, "allowed");
  } finally {
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("F7: agent 重启（进程内幂等表层丢失）后新 command_id 正常旅程", async () => {
  const mock = new MockAgent();
  const { handle, operator } = await appWith(mock);
  try {
    const r1 = await post(handle, "cp01b-f7-before-restart", { intent: startIntent() }, asOperator(operator));
    assert.equal(r1.statusCode, 200);
    mock.dispatches.length = 0;
    const r2 = await post(handle, "cp01b-f7-after-restart", { intent: startIntent() }, asOperator(operator));
    assert.equal(r2.statusCode, 200);
    assert.equal(r2.json().state, "completed");
    assert.equal(mock.dispatches.length, 1);
  } finally {
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("F8: 命令响应不含 mutable Runtime 现状（两平面：旅程 ≠ 现状）；未知 command → 404", async () => {
  const mock = new MockAgent();
  const { handle, operator } = await appWith(mock);
  try {
    const r = await post(handle, "cp01b-f8-key", { intent: startIntent() }, asOperator(operator));
    const body = r.json();
    assert.ok(!("sessions" in body) && !("devices" in body), "命令响应 = 旅程事实，非 Runtime 现状");
    const g = await handle.app.inject({
      method: "GET",
      url: "/api/v1/commands/x-not-found",
      headers: asOperator(operator),
    });
    assert.equal(g.statusCode, 404);
    assert.equal((g.json() as unknown as { error: { code: string } }).error.code, "RESOURCE_NOT_FOUND");
  } finally {
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("裁决映射：rejected→rejected；permanent→failed；不可辨识裁决→500 failed(unknown)", async () => {
  const mock = new MockAgent();
  const { handle, operator } = await appWith(mock);
  try {
    mock.verdict = {
      command_id: "x",
      status: { status: "executed" },
      kind: "start_session",
      classification: "rejected",
      detail: "switch_plane_unavailable",
    };
    const r1 = await post(handle, "cp01b-map-rejected", { intent: startIntent() }, asOperator(operator));
    assert.equal(r1.statusCode, 200);
    assert.equal(r1.json().state, "rejected");

    mock.verdict = {
      command_id: "x",
      status: { status: "executed" },
      kind: "start_session",
      classification: "permanent",
      detail: "session not found",
    };
    const r2 = await post(handle, "cp01b-map-failed", { intent: startIntent() }, asOperator(operator));
    assert.equal(r2.json().state, "failed");
    assert.equal(r2.json().classification, "permanent");

    mock.verdict = { bogus: true };
    const r3 = await post(handle, "cp01b-map-unknown", { intent: startIntent() }, asOperator(operator));
    assert.equal(r3.statusCode, 500);
    assert.equal((r3.json() as unknown as { error: { code: string } }).error.code, "INTERNAL_ERROR");
  } finally {
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("客户端输入边界：非法 session path UUID/空 devices intent → 400（形状拒绝不占幂等）", async () => {
  const mock = new MockAgent();
  const { handle, operator } = await appWith(mock);
  try {
    const r1 = await handle.app.inject({
      method: "POST",
      url: "/api/v1/sessions/session-11111111222233334444555566667777/stop",
      headers: { "idempotency-key": "cp01b-badpath", ...asOperator(operator) },
    });
    assert.equal(r1.statusCode, 400);
    const r2 = await post(handle, "cp01b-badintent", { intent: { version: "1.0", devices: [] } }, asOperator(operator));
    assert.equal(r2.statusCode, 400);
    const r3 = await post(handle, "cp01b-badintent", { intent: startIntent() }, asOperator(operator));
    assert.equal(r3.statusCode, 200, "形状拒绝未占幂等：同键换合法 payload 正常执行");
    assert.equal(r3.json().state, "completed");
  } finally {
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("GET /commands/{id}：终态 Operation 视图（command_id/state/时间线）", async () => {
  const mock = new MockAgent();
  const { handle, operator } = await appWith(mock);
  try {
    const r = await post(handle, "cp01b-getop", { intent: startIntent() }, asOperator(operator));
    const commandId = r.json().command_id as string;
    const g = await handle.app.inject({
      method: "GET",
      url: `/api/v1/commands/${commandId}`,
      headers: asOperator(operator),
    });
    assert.equal(g.statusCode, 200);
    const body = g.json() as Record<string, unknown>;
    assert.equal(body.command_id, commandId);
    assert.equal(body.state, "completed");
    assert.ok("created_at" in body && "terminal_at" in body);
  } finally {
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("审计持久化失败 → 命令终态迁移同事务回滚（pending 不变）；无'已终态无审计'", async () => {
  const mock = new MockAgent();
  const { handle, operator } = await appWith(mock);
  try {
    // 让审计写入失败：临时移除 audit_entries 表。
    await handle.db!.execute(sql`alter table audit_entries rename to audit_entries_bak`);
    const r = await post(handle, "cp01c-audit-fail-key", { intent: startIntent() }, asOperator(operator));
    assert.equal(r.statusCode, 500, "finalize 失败诚实 5xx，绝不假成功");
    await handle.db!.execute(sql`alter table audit_entries_bak rename to audit_entries`);
    const [row] = await handle.db!.select().from(commands).where(eq(commands.commandId, uuidV5("cp01c-audit-fail-key")));
    assert.ok(row !== undefined);
    assert.equal(row.state, "pending", "审计失败 → 终态迁移回滚，命令仍 pending");
    assert.equal(row.verdict, null, "不得残留半终态");
    // 修复后租约回收路径可将其诚实收敛为 timeout（不猜成功）。
    await handle.db!.execute(sql`update commands set created_at = now() - interval '1 hour' where command_id = ${uuidV5("cp01c-audit-fail-key")}`);
    const rec = await handle.app.inject({ method: "GET", url: `/api/v1/commands/${uuidV5("cp01c-audit-fail-key")}`, headers: asOperator(operator) });
    assert.equal(rec.statusCode, 200);
    assert.equal((rec.json() as Record<string, unknown>).state, "timeout");
  } finally {
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("skip 语义自证：无 DATABASE_TEST_URL 时本套件显式 skip（CI hermetic 依据）", { skip: hasDb }, () => {
  assert.ok(true);
});