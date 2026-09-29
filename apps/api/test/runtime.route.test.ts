/**
 * Product API route 测试（app.inject + 注入 fetch mock）：
 * F13 双向（agent wire 非法 → 5xx；客户端输入非法 → 4xx）、
 * session id 规范化、freshness 透传、依赖不可用语义、health 分层。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/server.ts";
import { loadConfig } from "../src/config.ts";
import { AgentControlClient, AgentTransportFailure } from "../src/agent/agentControlClient.ts";
import type { AgentQuerySnapshotWire } from "../src/agent/types.ts";
import { FixtureAuthenticator, fixturePrincipal } from "./helpers/fixtureAuth.ts";

function snapshotWith(sessionId: unknown): AgentQuerySnapshotWire {
  return {
    devices: [{ id: "dev-1", model: "Mock" }],
    ports: [{ id: "port-1", device_id: "dev-1", direction: "input" }],
    resources: [{ id: "res-1", device_id: "dev-1", state: "allocated" }],
    sessions: [
      {
        id: sessionId as string,
        state: "running",
        phase: "running",
        outputs: ["rtmp://out"],
        inputs: [{ id: "dev-1", handle: 3 }],
      },
    ],
    capabilities: [],
    generated_at_ms: 1_700_000_000_999,
    observation_revision: 7,
    observation_lineage: "00000000-0000-0000-0000-0000000000bb",
    program_switch: null,
  };
}

function fetchJson(payload: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(typeof payload === "string" ? payload : JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

const rpcOk = (result: unknown) => ({ jsonrpc: "2.0", result, id: 1 });

// CP-01C：/api/v1/* 默认 authenticated/authorized/audited/rate-limited——
// 本文件用显式 fixture authenticator（测试注入，非生产 dev bypass）提供
// operator 身份，聚焦 Product 读 API 语义本身。
const FIXTURE_KEY = "vbmf_fixture_operator_key";

function appWithAgent(agent: AgentControlClient) {
  const auth = new FixtureAuthenticator();
  auth.register(FIXTURE_KEY, fixturePrincipal("user-operator-1", "operator"));
  return buildApp(loadConfig({ ...process.env, LOG_LEVEL: "silent" }), {
    agent,
    withoutDb: true,
    authenticator: auth,
  });
}

interface InjectOpts {
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  payload?: object;
  headers?: Record<string, string>;
}

async function injectWithKey(app: Awaited<ReturnType<typeof buildApp>>, opts: InjectOpts) {
  return app.inject({
    method: opts.method,
    url: opts.url,
    ...(opts.payload !== undefined ? { payload: opts.payload } : {}),
    headers: { ...opts.headers, "x-api-key": FIXTURE_KEY },
  });
}

test("GET /api/v1/runtime: 200 + session id 规范化 UUID + label + freshness 透传", async () => {
  const agent = new AgentControlClient({
    baseUrl: "http://agent.invalid",
    fetchImpl: fetchJson(rpcOk(snapshotWith("session-11111111222233334444555566667777"))),
  });
  const app = await appWithAgent(agent);
  const res = await injectWithKey(app, { method: "GET", url: "/api/v1/runtime" });
  assert.equal(res.statusCode, 200);
  const body = res.json() as Record<string, unknown>;
  assert.equal(body.generated_at_ms, 1_700_000_000_999);
  assert.equal(body.observation_revision, 7);
  assert.equal(body.observation_lineage, "00000000-0000-0000-0000-0000000000bb");
  const session = (body.sessions as Record<string, unknown>[])[0]!;
  assert.equal(session.id, "11111111-2222-3333-4444-555566667777");
  assert.equal(session.label, "session-11111111222233334444555566667777");
  assert.equal(session.state, "running");
});

test("?session_id=<canonical uuid> 过滤命中", async () => {
  const agent = new AgentControlClient({
    baseUrl: "http://agent.invalid",
    fetchImpl: fetchJson(rpcOk(snapshotWith("session-11111111222233334444555566667777"))),
  });
  const app = await appWithAgent(agent);
  const res = await injectWithKey(app, {
    method: "GET",
    url: "/api/v1/runtime?session_id=11111111-2222-3333-4444-555566667777",
  });
  assert.equal(res.statusCode, 200);
  const sessions = (res.json() as Record<string, unknown>).sessions as unknown[];
  assert.equal(sessions.length, 1);
});

test("?session_id=<合法但不存在> → 404 RESOURCE_NOT_FOUND", async () => {
  const agent = new AgentControlClient({
    baseUrl: "http://agent.invalid",
    fetchImpl: fetchJson(rpcOk(snapshotWith("session-11111111222233334444555566667777"))),
  });
  const app = await appWithAgent(agent);
  const res = await injectWithKey(app, {
    method: "GET",
    url: "/api/v1/runtime?session_id=99999999-9999-9999-9999-999999999999",
  });
  assert.equal(res.statusCode, 404);
  const err = (res.json() as { error: Record<string, unknown> }).error;
  assert.equal(err.code, "RESOURCE_NOT_FOUND");
  assert.equal(err.retryable, false);
  assert.ok(typeof err.request_id === "string" && err.request_id.length > 0);
});

test("F13 客户端方向：非法 session_id（含 display 形态）→ 400 VALIDATION_ERROR", async () => {
  const agent = new AgentControlClient({
    baseUrl: "http://agent.invalid",
    fetchImpl: fetchJson(rpcOk(snapshotWith("session-11111111222233334444555566667777"))),
  });
  const app = await appWithAgent(agent);
  for (const bad of [
    "session-11111111222233334444555566667777", // display 形态不是 Product 输入形态
    "not-a-uuid",
    "11111111222233334444555566667777",
  ]) {
    const res = await injectWithKey(app, { method: "GET", url: `/api/v1/runtime?session_id=${bad}` });
    assert.equal(res.statusCode, 400, bad);
    const err = (res.json() as { error: Record<string, unknown> }).error;
    assert.equal(err.code, "VALIDATION_ERROR");
    assert.equal(err.retryable, false);
  }
});

test("F13 agent 方向：agent 返回非法 session id wire → 500 INTERNAL_ERROR，绝非 4xx", async () => {
  for (const badWire of ["weird-id", "11111111-2222-3333-4444-555566667777", 42]) {
    const agent = new AgentControlClient({
      baseUrl: "http://agent.invalid",
      fetchImpl: fetchJson(rpcOk(snapshotWith(badWire))),
    });
    const app = await appWithAgent(agent);
    const res = await injectWithKey(app, { method: "GET", url: "/api/v1/runtime" });
    assert.equal(res.statusCode, 500, `wire=${String(badWire)}`);
    const err = (res.json() as { error: Record<string, unknown> }).error;
    assert.equal(err.code, "INTERNAL_ERROR");
    assert.equal(err.retryable, false);
    // 不泄漏内部实现细节：响应体不回显原始 wire 值/内部诊断。
    // request_id 是服务端随机 UUID，可能碰巧包含 wire 数字子串（CI flaky
    // 实证：badWire=42 撞上 "-42dd-"）—— 剥离后检查，不降低断言强度。
    const raw = (res.body as string).replace(/"request_id"\s*:\s*"[^"]*"/g, "");
    const wireStr = String(badWire);
    assert.ok(
      !raw.includes(wireStr),
      `raw wire value must not leak (badWire=${wireStr}, body=${raw.slice(0, 240)})`,
    );
    assert.ok(!raw.includes("AgentWire"), "internal class names must not leak");
  }
});

test("依赖不可达 → 503 DEPENDENCY_UNAVAILABLE retryable=true（绝不假成功）", async () => {
  const failing = (async () => {
    throw new AgentTransportFailure("network", "connect ECONNREFUSED 127.0.0.1:50051");
  }) as unknown as typeof fetch;
  const agent = new AgentControlClient({ baseUrl: "http://agent.invalid", fetchImpl: failing });
  const app = await appWithAgent(agent);
  const res = await injectWithKey(app, { method: "GET", url: "/api/v1/runtime" });
  assert.equal(res.statusCode, 503);
  const err = (res.json() as { error: Record<string, unknown> }).error;
  assert.equal(err.code, "DEPENDENCY_UNAVAILABLE");
  assert.equal(err.retryable, true);
  assert.ok(!res.body.includes("ECONNREFUSED"), "内部诊断不得泄漏");
});

test("agent HTTP 503（unconfigured 诚实契约）→ 503 DEPENDENCY_UNAVAILABLE", async () => {
  const agent = new AgentControlClient({
    baseUrl: "http://agent.invalid",
    fetchImpl: fetchJson({ error: "service_unavailable: runtime.query" }, 503),
  });
  const app = await appWithAgent(agent);
  const res = await injectWithKey(app, { method: "GET", url: "/api/v1/runtime" });
  assert.equal(res.statusCode, 503);
  assert.equal((res.json() as { error: { code: string } }).error.code, "DEPENDENCY_UNAVAILABLE");
});

test("GET /health/live：无依赖探测恒 200（agent 不可达不 flap）", async () => {
  const failing = (async () => {
    throw new AgentTransportFailure("network", "down");
  }) as unknown as typeof fetch;
  const agent = new AgentControlClient({ baseUrl: "http://agent.invalid", fetchImpl: failing });
  const app = await appWithAgent(agent);
  const res = await app.inject({ method: "GET", url: "/health/live" });
  assert.equal(res.statusCode, 200);
  assert.equal((res.json() as { status: string }).status, "live");
});

test("GET /healthz：分层（api up；runtime up/unreachable 如实）", async () => {
  const healthy = new AgentControlClient({
    baseUrl: "http://agent.invalid",
    fetchImpl: fetchJson(
      rpcOk({
        state: "Ready",
        devices: 1,
        active_pipelines: 0,
        dropped_bus_events: 0,
        clock_lost_events: 0,
      }),
    ),
  });
  const app = await appWithAgent(healthy);
  const up = await app.inject({ method: "GET", url: "/healthz" });
  assert.equal(up.statusCode, 200);
  const upBody = up.json() as { layers: Record<string, Record<string, unknown>> };
  assert.equal(upBody.layers.api?.status, "up");
  assert.equal(upBody.layers.runtime?.status, "up");
  assert.equal(upBody.layers.runtime?.agent_state, "Ready");

  const failing = (async () => {
    throw new AgentTransportFailure("network", "down");
  }) as unknown as typeof fetch;
  const downApp = await appWithAgent(
    new AgentControlClient({ baseUrl: "http://agent.invalid", fetchImpl: failing }),
  );
  const down = await downApp.inject({ method: "GET", url: "/healthz" });
  assert.equal(down.statusCode, 200);
  const downBody = down.json() as { layers: Record<string, Record<string, unknown>> };
  assert.equal(downBody.layers.api?.status, "up");
  assert.equal(downBody.layers.runtime?.status, "unreachable");
});

test("未知路由 → 404 RESOURCE_NOT_FOUND envelope", async () => {
  const failing = (async () => {
    throw new AgentTransportFailure("network", "down");
  }) as unknown as typeof fetch;
  const agent = new AgentControlClient({ baseUrl: "http://agent.invalid", fetchImpl: failing });
  const app = await appWithAgent(agent);
  const res = await injectWithKey(app, { method: "GET", url: "/api/v1/nope" });
  assert.equal(res.statusCode, 404);
  assert.equal((res.json() as { error: { code: string } }).error.code, "RESOURCE_NOT_FOUND");
});

test("Product API 不代理 agent prototype /api/v1/*：唯一出站是 /internal/v1/agent", async () => {
  const captured: { url: string }[] = [];
  const recording = (async (input: string | URL | Request, init?: RequestInit) => {
    captured.push({ url: String(input) });
    return fetchJson(rpcOk(snapshotWith("session-11111111222233334444555566667777")))(
      input,
      init,
    );
  }) as typeof fetch;
  const agent = new AgentControlClient({ baseUrl: "http://agent.invalid", fetchImpl: recording });
  const app = await appWithAgent(agent);
  await injectWithKey(app, { method: "GET", url: "/api/v1/runtime" });
  await app.inject({ method: "GET", url: "/healthz" });
  for (const { url } of captured) {
    assert.ok(
      url.endsWith("/internal/v1/agent"),
      `outbound request must target the internal control path, got ${url}`,
    );
  }
});
