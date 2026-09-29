/**
 * HI-01B route tests — alarms Product API（ephemeral PG + inject）。
 * 运行：DATABASE_TEST_URL=… node --test --test-concurrency=1 test/alarms.routes.db.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.ts";
import { buildAppHandle, type AppHandle } from "../src/server.ts";
import { AgentControlClient } from "../src/agent/agentControlClient.ts";
import { createDb, runMigrations, type Db } from "../src/db/index.ts";
import { createAuth, type AuthDeps } from "../src/security/auth.ts";
import { provisionIdentity, type ProvisionedIdentity } from "./helpers/provisionDb.ts";
import { alarms, authUser, apiKeys, auditEntries, commands, eventOutbox } from "../src/db/schema.ts";
import { applyAlarmProjection } from "../src/alarms/alarmStore.ts";
import { sql } from "drizzle-orm";

const DB_URL = process.env.DATABASE_TEST_URL;
const hasDb = DB_URL !== undefined && DB_URL !== "";
const dbTest = (name: string, fn: () => Promise<void>) =>
  test(name, { skip: !hasDb }, fn);

const SECRET = "test-secret-value-0123456789abcdef0123456789";
const session = "11111111-1111-1111-1111-111111111111";
const pipeline = "33333333-3333-3333-3333-333333333333";

function snapshotAgent(): AgentControlClient {
  return new AgentControlClient({
    baseUrl: "http://127.0.0.1:9",
    fetchImpl: (async () => new Response("{}", { status: 200 })) as typeof fetch,
  });
}

async function appWith(role: string): Promise<{ handle: AppHandle; key: string }> {
  const config = loadConfig({
    ...process.env,
    LOG_LEVEL: "silent",
    DATABASE_URL: DB_URL,
    BETTER_AUTH_SECRET: SECRET,
    MIGRATE_ON_BOOT: "false",
  });
  const handle = await buildAppHandle(config, { agent: snapshotAgent() });
  const auth = createAuth({ db: handle.db as Db, secret: SECRET } as AuthDeps);
  const identity: ProvisionedIdentity = await provisionIdentity(handle.db as Db, auth, { role });
  return { handle, key: identity.apiKey };
}

async function freshDb(): Promise<{ db: Db; end: () => Promise<void> }> {
  const { db, pool } = createDb(DB_URL!);
  await runMigrations(db);
  await db.execute(
    sql`truncate table ${alarms}, ${eventOutbox}, ${auditEntries}, ${commands}, ${authUser}, ${apiKeys}, auth_session, auth_account, auth_verification`,
  );
  return { db, end: () => pool.end() };
}

function faultProjection(faults: object[]): Parameters<typeof applyAlarmProjection>[1] {
  return {
    snapshot_kind: "event_projection_snapshot",
    total: faults.length,
    kind_counts: {},
    session_states: {},
    session_failures: {},
    has_critical: faults.length > 0,
    faults: faults as never,
  };
}

dbTest("hi01b: GET /api/v1/alarms — 401 无凭证 / 200 operator / active 过滤", async () => {
  const { db, end } = await freshDb();
  try {
    await applyAlarmProjection(
      db,
      faultProjection([{ kind: "pipeline_fault", pipeline, summary: "x", retryable: true }]),
    );
    await applyAlarmProjection(
      db,
      faultProjection([{ kind: "session_failed", session_id: session, summary: "fail" }]),
    );
    // cleared one
    await applyAlarmProjection(db, {
      snapshot_kind: "event_projection_snapshot",
      total: 1,
      kind_counts: {},
      session_states: { [session]: "released" },
      session_failures: {},
      has_critical: false,
      faults: [],
    });

    const { handle, key } = await appWith("operator");
    try {
      const unauth = await handle.app.inject({ method: "GET", url: "/api/v1/alarms" });
      assert.equal(unauth.statusCode, 401);

      const all = await handle.app.inject({
        method: "GET",
        url: "/api/v1/alarms",
        headers: { "x-api-key": key },
      });
      assert.equal(all.statusCode, 200);
      assert.equal(all.json().count, 2);

      const activeOnly = await handle.app.inject({
        method: "GET",
        url: "/api/v1/alarms?active=true",
        headers: { "x-api-key": key },
      });
      assert.equal(activeOnly.json().count, 1);
      assert.equal(activeOnly.json().alarms[0].active, true);
      assert.equal(activeOnly.json().alarms[0].kind, "pipeline_fault");
      assert.equal(activeOnly.json().alarms[0].failure_domain, "pipeline");
      assert.equal(activeOnly.json().alarms[0].severity, "warning");
    } finally {
      await handle.app.close();
    }
  } finally {
    await end();
  }
});

dbTest("hi01b: GET /api/v1/alarms/:id — 单条 + 404", async () => {
  const { db, end } = await freshDb();
  try {
    await applyAlarmProjection(
      db,
      faultProjection([{ kind: "hardware_fault", device_id: "22222222-2222-2222-2222-222222222222", summary: "decklink lost" }]),
    );
    const rows = await db.select().from(alarms);
    const id = rows[0]!.id;
    const { handle, key } = await appWith("viewer");
    try {
      const got = await handle.app.inject({
        method: "GET",
        url: `/api/v1/alarms/${id}`,
        headers: { "x-api-key": key },
      });
      assert.equal(got.statusCode, 200);
      assert.equal(got.json().id, id);
      assert.equal(got.json().severity, "error");

      const missing = await handle.app.inject({
        method: "GET",
        url: "/api/v1/alarms/00000000-0000-0000-0000-000000000000",
        headers: { "x-api-key": key },
      });
      assert.equal(missing.statusCode, 404);
    } finally {
      await handle.app.close();
    }
  } finally {
    await end();
  }
});

dbTest("hi01b: POST ack — viewer 403 / operator 200 只写 ack_* 三字段（active 不变）+ 幂等", async () => {
  const { db, end } = await freshDb();
  try {
    await applyAlarmProjection(
      db,
      faultProjection([{ kind: "session_failed", session_id: session, summary: "fail" }]),
    );
    const id = (await db.select().from(alarms))[0]!.id;

    const viewer = await appWith("viewer");
    try {
      const denied = await viewer.handle.app.inject({
        method: "POST",
        url: `/api/v1/alarms/${id}/ack`,
        headers: { "x-api-key": viewer.key },
        payload: {},
      });
      assert.equal(denied.statusCode, 403, "viewer 无 ack 权限");
    } finally {
      await viewer.handle.app.close();
    }

    const op = await appWith("operator");
    try {
      const acked = await op.handle.app.inject({
        method: "POST",
        url: `/api/v1/alarms/${id}/ack`,
        headers: { "x-api-key": op.key },
        payload: { note: "operator aware" },
      });
      assert.equal(acked.statusCode, 200);
      const body = acked.json();
      assert.equal(body.ack_by !== null, true);
      assert.equal(body.ack_note, "operator aware");
      assert.equal(body.active, true, "ACK 不改变 active（awareness only 红线）");
      assert.equal(body.recovery_status, "active", "ACK 不改变恢复状态");

      const again = await op.handle.app.inject({
        method: "POST",
        url: `/api/v1/alarms/${id}/ack`,
        headers: { "x-api-key": op.key },
        payload: { note: "re-ack" },
      });
      assert.equal(again.statusCode, 200, "重复 ack 幂等 200");
      assert.equal(again.json().ack_note, "re-ack");

      // 审计行存在（who/action）。
      const auditRows = await db.select().from(auditEntries);
      assert.equal(
        auditRows.filter((r) => r.action === "alarm.ack").length >= 1,
        true,
      );
    } finally {
      await op.handle.app.close();
    }
  } finally {
    await end();
  }
});

dbTest("hi01b: hermetic 边界 — limit 校验 400", async () => {
  const { handle, key } = await appWith("operator");
  try {
    const bad = await handle.app.inject({
      method: "GET",
      url: "/api/v1/alarms?limit=0",
      headers: { "x-api-key": key },
    });
    assert.equal(bad.statusCode, 400);
  } finally {
    await handle.app.close();
  }
});
