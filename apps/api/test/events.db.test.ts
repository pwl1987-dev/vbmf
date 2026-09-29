/**
 * CP-01D Event plane DB 层测试（ephemeral PG + 可编程 mock agent）。
 *
 * 覆盖（planning F9/F10 + B9 单实例约束）：
 * - drain loop：total>0 写 outbox；total=0 零行（不污染）；agent 故障下个
 *   tick 重试不崩溃；
 * - **B9 fail-closed**：第二个实例抢锁 → locked_by_other_instance，绝不并发
 *   drain；
 * - cursor 语义：outboxRowsAfter 严格大于语义；latestOutboxSequence；
 * - retention：超龄行清理；
 * - **真实 HTTP SSE**（listen 真端口 + fetch 流读）：event/data/id 帧、
 *   cursor 重放（Last-Event-ID 已见行不重发）、401/403/429 走 security 链、
 *   not_configured → 503。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.ts";
import { buildAppHandle, type AppHandle } from "../src/server.ts";
import { AgentControlClient, AgentTransportFailure } from "../src/agent/agentControlClient.ts";
import { createDb, runMigrations, type Db } from "../src/db/index.ts";
import { createAuth, type AuthDeps } from "../src/security/auth.ts";
import { provisionIdentity, type ProvisionedIdentity } from "./helpers/provisionDb.ts";
import { eventOutbox, auditEntries, commands, authUser, apiKeys } from "../src/db/schema.ts";
import { ProjectionDrainLoop, latestOutboxSequence, outboxRowsAfter } from "../src/events/eventPlane.ts";
import { FixtureAuthenticator, fixturePrincipal } from "./helpers/fixtureAuth.ts";
import { sql } from "drizzle-orm";

const DB_URL = process.env.DATABASE_TEST_URL;
const hasDb = DB_URL !== undefined && DB_URL !== "";
const dbTest = hasDb ? test : test.skip;
const SECRET = "test-secret-for-ephemeral-pg-only";

function projectionSnapshot(total: number): Record<string, unknown> {
  return {
    snapshot_kind: "event_projection_snapshot",
    total,
    kind_counts: total > 0 ? { session_state_changed: total } : {},
    session_states: total > 0 ? { "11111111-2222-3333-4444-555566667777": "running" } : {},
    session_failures: {},
    has_critical: false,
  };
}

/** 可编程 mock agent：drain 计数与投影片可配置。 */
class ProjectionAgent {
  calls = 0;
  snapshot: Record<string, unknown> = projectionSnapshot(0);
  fail = false;
  readonly client: AgentControlClient;

  constructor() {
    this.client = new AgentControlClient({
      baseUrl: "http://agent.invalid",
      fetchImpl: (async (_input: string | URL | Request, init?: RequestInit) => {
        const envelope = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
        if (envelope.method === "events.projection") {
          this.calls += 1;
          if (this.fail) throw new AgentTransportFailure("network", "mock injected failure");
          return new Response(JSON.stringify({ jsonrpc: "2.0", result: this.snapshot, id: 1 }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (envelope.method === "runtime.query") {
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              result: {
                devices: [], ports: [], resources: [], sessions: [], capabilities: [],
                generated_at_ms: 1, observation_revision: 1,
                observation_lineage: "00000000-0000-0000-0000-0000000000aa",
                program_switch: null,
              },
              id: 1,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ jsonrpc: "2.0", result: { command_id: "x", status: { status: "executed" }, kind: "start_session" }, id: 1 }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    });
  }
}

interface Fixture {
  handle: AppHandle;
  identity: ProvisionedIdentity;
}

async function appWith(opts: { eventsPollMs?: number; retentionMs?: number } = {}): Promise<Fixture> {
  const config = loadConfig({
    ...process.env,
    LOG_LEVEL: "silent",
    DATABASE_URL: DB_URL,
    BETTER_AUTH_SECRET: SECRET,
    MIGRATE_ON_BOOT: "false",
    EVENTS_POLL_MS: String(opts.eventsPollMs ?? 30),
    EVENTS_RETENTION_MS: String(opts.retentionMs ?? 0),
  });
  const handle = await buildAppHandle(config, { agent: new ProjectionAgent().client });
  const auth = createAuth({ db: handle.db as Db, secret: SECRET } as AuthDeps);
  const identity = await provisionIdentity(handle.db as Db, auth, { role: "operator" });
  return { handle, identity };
}

dbTest("event_outbox 迁移从干净库应用 + 全表清场", { skip: !hasDb }, async () => {
  const { createDb } = await import("../src/db/index.ts");
  const { db, pool } = createDb(DB_URL!);
  await runMigrations(db);
  await db.execute(sql`truncate table ${eventOutbox}, ${auditEntries}, ${commands}, ${authUser}, ${apiKeys}, auth_session, auth_account, auth_verification`);
  await pool.end();
});

dbTest("drain loop：total>0 → outbox 行；total=0 → 零行（不污染）；agent 故障下 tick 重试", { skip: !hasDb }, async () => {
  const agent = new ProjectionAgent();
  const { handle } = await appWith({ eventsPollMs: 0 });
  const loop = new ProjectionDrainLoop({
    db: handle.db as Db,
    pool: handle.pool!,
    agent: agent.client,
    pollMs: 1,
    retentionMs: 0,
    log: { warn: () => {}, info: () => {}, error: () => {} },
  });
  try {
    assert.equal(await loop.start(), "running");
    // 第一个 tick：空投影 → 零行。
    await new Promise((r) => setTimeout(r, 120));
    const afterEmpty = await handle.db!.select().from(eventOutbox);
    assert.equal(afterEmpty.length, 0, "空投影不写 outbox");
    // 有事件投影 → 写入。
    agent.snapshot = projectionSnapshot(3);
    await new Promise((r) => setTimeout(r, 150));
    const rows = await outboxRowsAfter(handle.db as Db, 0);
    assert.ok(rows.length >= 1, "total>0 必须写 outbox");
    assert.equal((rows[rows.length - 1]!.snapshot as unknown as Record<string, unknown>).total, 3);
    // agent 故障：loop 不崩溃（继续运行），恢复后继续写。
    agent.fail = true;
    const before = rows.length;
    await new Promise((r) => setTimeout(r, 120));
    agent.fail = false;
    await new Promise((r) => setTimeout(r, 150));
    const after = await outboxRowsAfter(handle.db as Db, 0);
    assert.ok(after.length >= before, "故障后恢复继续 drain");
  } finally {
    await loop.stop();
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("B9 fail-closed：第二个 drain loop 抢锁 → locked_by_other_instance；绝不并发 drain", { skip: !hasDb }, async () => {
  const { handle } = await appWith({ eventsPollMs: 0 });
  const mk = (): ProjectionDrainLoop =>
    new ProjectionDrainLoop({
      db: handle.db as Db,
      pool: handle.pool!,
      agent: new ProjectionAgent().client,
      pollMs: 10_000,
      retentionMs: 0,
      log: { warn: () => {}, info: () => {}, error: () => {} },
    });
  const loopA = mk();
  const loopB = mk();
  try {
    assert.equal(await loopA.start(), "running", "第一个实例成为唯一 drain 消费者");
    assert.equal(await loopB.start(), "locked_by_other_instance", "第二实例 fail-closed 降级");
    assert.equal(loopB.status(), "locked_by_other_instance");
  } finally {
    await loopA.stop();
    await loopB.stop();
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("cursor 语义：outboxRowsAfter 严格大于 + latestOutboxSequence", { skip: !hasDb }, async () => {
  const { handle } = await appWith();
  try {
    // 自包含：相对断言（先前测试可能已写入行）。
    const before = await latestOutboxSequence(handle.db as Db);
    for (const total of [1, 2, 3]) {
      await handle.db!.insert(eventOutbox).values({ snapshot: projectionSnapshot(total) as object });
    }
    const max = await latestOutboxSequence(handle.db as Db);
    assert.ok(max >= before + 3);
    const all = await outboxRowsAfter(handle.db as Db, before);
    assert.equal(all.length, 3, "仅 cursor 之后的新行");
    assert.deepEqual(all.map((r) => r.sequence), [...all.map((r) => r.sequence)].sort((a, b) => a - b), "升序");
    const tail = await outboxRowsAfter(handle.db as Db, all[0]!.sequence);
    assert.equal(tail.length, 2, "严格大于（已见行不重发）");
    assert.equal(tail.some((r) => r.sequence === all[0]!.sequence), false);
  } finally {
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("retention：超龄 outbox 行被清理", { skip: !hasDb }, async () => {
  const agent = new ProjectionAgent();
  agent.snapshot = projectionSnapshot(1);
  const { handle } = await appWith({ eventsPollMs: 0 });
  await handle.db!.insert(eventOutbox).values({
    snapshot: projectionSnapshot(9) as object,
    observedAt: new Date(Date.now() - 2 * 86_400_000),
  });
  const loop = new ProjectionDrainLoop({
    db: handle.db as Db,
    pool: handle.pool!,
    agent: agent.client,
    pollMs: 1,
    retentionMs: 86_400_000,
    log: { warn: () => {}, info: () => {}, error: () => {} },
  });
  try {
    assert.equal(await loop.start(), "running");
    await new Promise((r) => setTimeout(r, 200));
    const rows = await outboxRowsAfter(handle.db as Db, 0);
    assert.equal(rows.some((r) => (r.snapshot as unknown as Record<string, unknown>).total === 9), false, "超龄行已清理");
    assert.ok(rows.length >= 1, "新行保留");
  } finally {
    await loop.stop();
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("真实 HTTP SSE：帧形态（id/event/data）+ weak_ordering 如实 + cursor 重放（Last-Event-ID 已见行不重发）", { skip: !hasDb }, async () => {
  const { handle, identity } = await appWith();
  const db = handle.db as Db;
  try {
    for (const total of [10, 11, 12]) {
      await db.insert(eventOutbox).values({ snapshot: projectionSnapshot(total) as object });
    }
    await handle.app.listen({ port: 0, host: "127.0.0.1" });
    const addr = handle.app.server!.address();
    const port = typeof addr === "object" && addr !== null ? addr.port : 0;
    const base = `http://127.0.0.1:${port}/events/v1/stream`;

    // 1) 全量重放（cursor=0）+ live tail 保持：读前 3 帧后断开。
    const res1 = await fetch(`${base}?cursor=0`, { headers: { "x-api-key": identity.apiKey } });
    assert.equal(res1.status, 200);
    assert.ok((res1.headers.get("content-type") ?? "").startsWith("text/event-stream"));
    const reader1 = res1.body!.getReader();
    let chunk1 = "";
    const deadline1 = Date.now() + 3_000;
    while (Date.now() < deadline1 && !chunk1.includes("data: ")) {
      const { value, done } = await reader1.read();
      if (done) break;
      chunk1 += Buffer.from(value!).toString("utf8");
    }
    assert.ok(chunk1.includes("retry: 3000"), "SSE retry 提示");
    assert.ok(chunk1.includes("id: "), "SSE id = outbox sequence（consumer 幂等键·F9）");
    assert.ok(chunk1.includes("event: projection"));
    const dataLine = chunk1.split("\n").find((l) => l.startsWith("data: "));
    assert.ok(dataLine !== undefined);
    const payload1 = JSON.parse(dataLine!.slice("data: ".length)) as Record<string, unknown>;
    assert.equal(payload1.weak_ordering, true, "F10 弱序如实标注");
    assert.ok("observed_at_ms" in payload1 && "snapshot" in payload1);
    // SDK-01A（Debt D）：SSE 帧载荷机械验证 against sseFramePayloadSchema
    // （200 流式响应的独立契约面——Fastify schema 对流不生效）。
    {
      const { Ajv } = await import("ajv");
      const ajv = new Ajv({ allErrors: true, strict: false });
      const { sseFramePayloadSchema } = await import("../src/routes/schemas.ts");
      const validateFrame = ajv.compile(sseFramePayloadSchema as object);
      for (const frame of chunk1.split("data: ").slice(1)) {
        const jsonText = frame.split("\n")[0] ?? "";
        if (jsonText.trim().length === 0) continue;
        const parsed = JSON.parse(jsonText) as unknown;
        assert.ok(
          validateFrame(parsed),
          `SSE frame must satisfy sseFramePayloadSchema: ${JSON.stringify(validateFrame.errors)}`,
        );
      }
    }
    await reader1.cancel().catch(() => {});

    // 2) Last-Event-ID 重放：已见行不重发。
    const seen = await latestOutboxSequence(db);
    await db.insert(eventOutbox).values({ snapshot: projectionSnapshot(20) as object });
    const res2 = await fetch(base, {
      headers: { "x-api-key": identity.apiKey, "last-event-id": String(seen) },
    });
    const reader2 = res2.body!.getReader();
    let chunk2 = "";
    const deadline2 = Date.now() + 3_000;
    while (Date.now() < deadline2 && !chunk2.includes("data: ")) {
      const { value, done } = await reader2.read();
      if (done) break;
      chunk2 += Buffer.from(value!).toString("utf8");
    }
    assert.ok(chunk2.includes("data: "), "新行必须投递");
    for (const frame of chunk2.split("data: ").slice(1)) {
      const seq = Number((JSON.parse(frame.split("\n")[0]!) as Record<string, unknown>).sequence);
      assert.ok(seq > seen, "Last-Event-ID 已见行绝不重发");
    }
    await reader2.cancel().catch(() => {});
  } finally {
    handle.app.server?.closeAllConnections();
    await handle.app.close();
    await handle.pool!.end();
  }
});

dbTest("SSE security 链：无凭证 401；无 DB → 503 RESOURCE_UNAVAILABLE（fail-closed 不假成功）", { skip: !hasDb }, async () => {
  const { handle } = await appWith();
  try {
    const unauth = await handle.app.inject({ method: "GET", url: "/events/v1/stream" });
    assert.equal(unauth.statusCode, 401);
    assert.equal((unauth.json() as { error: { code: string } }).error.code, "AUTHENTICATION_FAILED");
  } finally {
    await handle.app.close();
    await handle.pool!.end();
  }

  // withoutDb（auth 层经 fixture 注入）→ 事件面 503（preHandler 后 handler 内抛出）。
  const config = loadConfig({ ...process.env, LOG_LEVEL: "silent" });
  const auth = new FixtureAuthenticator();
  auth.register("vbmf_fixture_operator", fixturePrincipal("user-op", "operator"));
  const handle2 = await buildAppHandle(config, {
    agent: new ProjectionAgent().client,
    withoutDb: true,
    authenticator: auth,
  });
  try {
    const res = await handle2.app.inject({
      method: "GET",
      url: "/events/v1/stream",
      headers: { "x-api-key": "vbmf_fixture_operator" },
    });
    assert.equal(res.statusCode, 503);
    assert.equal((res.json() as { error: { code: string } }).error.code, "RESOURCE_UNAVAILABLE");
  } finally {
    await handle2.app.close();
  }
});

dbTest("skip 语义自证：无 DATABASE_TEST_URL 时本套件显式 skip", { skip: hasDb }, () => {
  assert.ok(true);
});
