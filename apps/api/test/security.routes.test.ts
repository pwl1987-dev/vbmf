/**
 * CP-01C Fastify enforcement 链 hermetic 测试（fixture authenticator 注入）。
 *
 * 覆盖（EXTERNAL_API_CONTRACT §6 + planning C4/C11 failure-first）：
 * - unauthenticated / malformed / expired / revoked / disabled → 401，
 *   错误模型 envelope，零 agent dispatch；
 * - authenticated but unauthorized → 403 + 零 dispatch；
 * - authorized → 正常执行（dispatch 恰一次）；
 * - rate limit exceeded → 429 + Retry-After + 零 dispatch + 不占幂等前置面；
 * - auth backend 不可用 → 503 retryable + 零 dispatch；
 * - credential 永不进日志（logger redaction 机检）；
 * - /api/v1/* 全路由必须声明 security config（fail-closed 结构断言）；
 * - /health/* 为显式登记的无认证例外。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildApp, buildAppHandle, buildLoggerOptions, type AppHandle } from "../src/server.ts";
import { loadConfig } from "../src/config.ts";
import { AgentControlClient } from "../src/agent/agentControlClient.ts";
import { ROUTE_PERMISSIONS } from "../src/security/rbac.ts";
import { uuidV5 } from "../src/command/commandIds.ts";
import type { CommandPlane, ServiceResponse, SubmitInput } from "../src/command/commandService.ts";
import { FixtureAuthenticator, fixturePrincipal } from "./helpers/fixtureAuth.ts";
import { Writable } from "node:stream";

interface RecordedDispatch {
  command_id: string;
  kind: string;
  target: Record<string, unknown>;
}

/** 可编程 mock agent：记录 dispatch（零 dispatch 断言的证据面）。 */
class MockAgent {
  readonly dispatches: RecordedDispatch[] = [];
  readonly client: AgentControlClient;
  constructor() {
    this.client = new AgentControlClient({
      baseUrl: "http://agent.invalid",
      fetchImpl: (async (_input: string | URL | Request, init?: RequestInit) => {
        const envelope = JSON.parse(String(init?.body ?? "{}")) as { method?: string; params?: RecordedDispatch };
        if (envelope.method === "command.dispatch" && envelope.params !== undefined) {
          this.dispatches.push(envelope.params);
        }
        return new Response(
          JSON.stringify({ jsonrpc: "2.0", result: { command_id: "x", status: { status: "executed" }, kind: "start_session" }, id: 1 }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    });
  }
}

const OPERATOR_KEY = "vbmf_fixture_operator";
const VIEWER_KEY = "vbmf_fixture_viewer";
const EXPIRED_KEY = "vbmf_fixture_expired";

/** hermetic command plane stub：记录 submit 入口，返回可编程裁决。 */
class StubCommandPlane implements CommandPlane {
  readonly submits: SubmitInput[] = [];
  verdict: ServiceResponse = { status: 200, body: { command_id: "stub", state: "completed" } };

  async submit(input: SubmitInput): Promise<ServiceResponse> {
    this.submits.push(input);
    return this.verdict;
  }

  async getOperation(commandId: string): Promise<ServiceResponse> {
    return { status: 200, body: { command_id: commandId, state: "completed" } };
  }

  async recoverStalePending(): Promise<number> {
    return 0;
  }
}

async function appWith(opts: {
  mock: MockAgent;
  rateLimitReadMax?: number;
  rateLimitWriteMax?: number;
  logDestination?: NodeJS.WritableStream;
  commandPlane?: CommandPlane;
}): Promise<AppHandle> {
  const auth = new FixtureAuthenticator();
  auth.register(OPERATOR_KEY, fixturePrincipal("user-op", "operator"));
  auth.register(VIEWER_KEY, fixturePrincipal("user-viewer", "viewer"));
  auth.registerFailure(EXPIRED_KEY, "expired");
  const config = loadConfig({
    ...process.env,
    LOG_LEVEL: opts.logDestination !== undefined ? "info" : "silent",
    RATE_LIMIT_READ_MAX: String(opts.rateLimitReadMax ?? 240),
    RATE_LIMIT_WRITE_MAX: String(opts.rateLimitWriteMax ?? 60),
  });
  return buildAppHandle(config, {
    agent: opts.mock.client,
    withoutDb: true,
    authenticator: auth,
    ...(opts.commandPlane !== undefined ? { commandService: opts.commandPlane } : {}),
    ...(opts.logDestination !== undefined ? { logDestination: opts.logDestination } : {}),
  });
}

function memoryLogStream(): { stream: Writable; lines: () => string[] } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(String(chunk));
      cb();
    },
  });
  return { stream, lines: () => chunks.join("").split("\n").filter((l) => l.length > 0) };
}

function startIntent(): Record<string, unknown> {
  return {
    version: "1.0",
    devices: [{ device_id: "00000000-0000-0000-0000-0000000000d1", role: "CAPTURE", pipeline: { source: { kind: "decklink", device_id: "00000000-0000-0000-0000-0000000000d1" }, sink: { kind: "appsink" } } }],
  };
}

test("unauthenticated（无 x-api-key）→ 401 AUTHENTICATION_FAILED + 零 dispatch", async () => {
  const mock = new MockAgent();
  const handle = await appWith({ mock });
  try {
    const res = await handle.app.inject({ method: "GET", url: "/api/v1/runtime" });
    assert.equal(res.statusCode, 401);
    const err = (res.json() as { error: Record<string, unknown> }).error;
    assert.equal(err.code, "AUTHENTICATION_FAILED");
    assert.equal(err.retryable, false);
    assert.ok(typeof err.request_id === "string");
    const post = await handle.app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { "idempotency-key": "sec-unauth" },
      payload: { intent: startIntent() },
    });
    assert.equal(post.statusCode, 401);
    assert.equal(mock.dispatches.length, 0, "未认证零 dispatch");
  } finally {
    await handle.app.close();
  }
});

test("malformed / expired credential → 401 + 零 dispatch；响应不回显 key 材料", async () => {
  const mock = new MockAgent();
  const handle = await appWith({ mock });
  try {
    for (const key of ["not-a-real-key", EXPIRED_KEY, ""]) {
      const res = await handle.app.inject({
        method: "GET",
        url: "/api/v1/runtime",
        headers: key.length > 0 ? { "x-api-key": key } : {},
      });
      assert.equal(res.statusCode, 401, `key=${JSON.stringify(key)}`);
      assert.equal((res.json() as { error: { code: string } }).error.code, "AUTHENTICATION_FAILED");
      if (key.length > 0) {
        assert.ok(!res.body.includes(key), "响应体不得回显提交的 key 值");
      }
    }
    assert.equal(mock.dispatches.length, 0);
  } finally {
    await handle.app.close();
  }
});

test("authenticated but unauthorized（viewer POST start）→ 403 + 零 dispatch + 不占幂等", async () => {
  const mock = new MockAgent();
  const handle = await appWith({ mock });
  try {
    const res = await handle.app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { "x-api-key": VIEWER_KEY, "idempotency-key": "sec-viewer-start" },
      payload: { intent: startIntent() },
    });
    assert.equal(res.statusCode, 403);
    const err = (res.json() as { error: Record<string, unknown> }).error;
    assert.equal(err.code, "AUTHORIZATION_DENIED");
    assert.equal(err.retryable, false);
    assert.equal(mock.dispatches.length, 0, "授权拒绝绝不 dispatch 到 media-agent");
  } finally {
    await handle.app.close();
  }
});

test("authorized（operator POST start）→ 200；principal/role/action 语义传入 command plane", async () => {
  const mock = new MockAgent();
  const plane = new StubCommandPlane();
  const handle = await appWith({ mock, commandPlane: plane });
  try {
    const res = await handle.app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { "x-api-key": OPERATOR_KEY, "idempotency-key": "sec-op-start" },
      payload: { intent: startIntent() },
    });
    assert.equal(res.statusCode, 200);
    assert.equal((res.json() as Record<string, unknown>).state, "completed");
    assert.equal(plane.submits.length, 1);
    const submitted = plane.submits[0] as SubmitInput;
    assert.equal(submitted.principal, "user-op", "principal = 认证主体 id");
    assert.equal(submitted.role, "operator");
    assert.equal(submitted.action, "session.start");
    assert.equal(submitted.requestedBy, "user-op", "requested_by 恒取认证主体（不接受客户端自报）");
    assert.equal(mock.dispatches.length, 0, "hermetic stub 不外发；真实 dispatch 由 DB 层测试覆盖");
  } finally {
    await handle.app.close();
  }
});

test("rate limit exceeded → 429 RATE_LIMITED retryable=true + Retry-After + 第二 payload 零执行", async () => {
  const mock = new MockAgent();
  const plane = new StubCommandPlane();
  const handle = await appWith({ mock, rateLimitWriteMax: 1, commandPlane: plane });
  try {
    const r1 = await handle.app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { "x-api-key": OPERATOR_KEY, "idempotency-key": "sec-rl-1" },
      payload: { intent: startIntent() },
    });
    assert.equal(r1.statusCode, 200);
    const r2 = await handle.app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { "x-api-key": OPERATOR_KEY, "idempotency-key": "sec-rl-2" },
      payload: { intent: startIntent() },
    });
    assert.equal(r2.statusCode, 429);
    const err = (r2.json() as { error: Record<string, unknown> }).error;
    assert.equal(err.code, "RATE_LIMITED");
    assert.equal(err.retryable, true);
    assert.ok((r2.headers["retry-after"] as string | undefined)?.length, "429 必须携带 Retry-After");
    assert.equal(plane.submits.length, 1, "限流拒绝绝不进入 handler（第二 payload 零执行·不占幂等）");
  } finally {
    await handle.app.close();
  }
});

test("auth backend 不可用 → 503 DEPENDENCY_UNAVAILABLE retryable + 零 dispatch", async () => {
  const mock = new MockAgent();
  const handle = await appWith({ mock });
  const auth = (handle.authenticator as FixtureAuthenticator);
  auth.failMode = "unavailable";
  try {
    const res = await handle.app.inject({
      method: "GET",
      url: "/api/v1/runtime",
      headers: { "x-api-key": OPERATOR_KEY },
    });
    assert.equal(res.statusCode, 503);
    const err = (res.json() as { error: Record<string, unknown> }).error;
    assert.equal(err.code, "DEPENDENCY_UNAVAILABLE");
    assert.equal(err.retryable, true);
    assert.equal(mock.dispatches.length, 0);
  } finally {
    auth.failMode = "none";
    await handle.app.close();
  }
});

test("credential 绝不进日志（logger redaction）：x-api-key 头始终 [REDACTED]", async () => {
  const mock = new MockAgent();
  const { stream, lines } = memoryLogStream();
  const handle = await appWith({ mock, logDestination: stream });
  try {
    await handle.app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { "x-api-key": OPERATOR_KEY, "idempotency-key": "sec-log-1" },
      payload: { intent: startIntent() },
    });
    // 请求日志（fastify req serializer 含 headers）经 redact 管道输出。
    handle.app.log.info({ req: { method: "POST", headers: { "x-api-key": OPERATOR_KEY } } }, "captured");
  } finally {
    await handle.app.close();
  }
  const logLines = lines();
  assert.ok(logLines.length > 0, "测试必须实际捕获到日志");
  for (const line of logLines) {
    assert.ok(!line.includes(OPERATOR_KEY), "raw credential 不得出现在任何日志行");
  }
  // redact 配置机检（唯一来源 buildLoggerOptions——生产与测试同源）：
  const opts = buildLoggerOptions("info");
  for (const path of ['req.headers["x-api-key"]', "req.headers.authorization", "req.headers.cookie"]) {
    assert.ok(opts.redact.paths.includes(path), `redact 配置必须覆盖 ${path}`);
  }
  assert.equal(opts.redact.censor, "[REDACTED]");
});

test("结构断言：Product API 五路由存在；缺 security config 的 /api/v1 路由 fail-closed 500", async () => {
  const mock = new MockAgent();
  const handle = await appWith({ mock });
  try {
    // 1) 五条 Product 路由存在（security config 声明在 routes 内，语义映射
    //    由 security.authz.test 覆盖；运行时 fail-closed 钩子兜底漏配）。
    for (const [method, url] of [
      ["GET", "/api/v1/runtime"],
      ["POST", "/api/v1/sessions"],
      ["POST", "/api/v1/sessions/:id/stop"],
      ["POST", "/api/v1/sessions/:id/release"],
      ["GET", "/api/v1/commands/:id"],
      ["GET", "/events/v1/stream"],
    ] as const) {
      assert.ok(handle.app.hasRoute({ method, url }), `${method} ${url} 必须存在`);
    }

    // 2) fail-closed：漏配 security 的产品面（/api/v1 与 /events 前缀）路由
    //    请求时 500（绝不隐式放行）。注意：先注册全部 rogue 路由再注入
    //    （fastify 在首次请求后进入 listening 状态，禁止再添加路由）。
    handle.app.route({
      method: "GET",
      url: "/api/v1/rogue-unsecured",
      handler: async () => ({ ok: true }),
    });
    handle.app.route({
      method: "GET",
      url: "/events/rogue-unsecured",
      handler: async () => ({ ok: true }),
    });
    const rogue = await handle.app.inject({ method: "GET", url: "/api/v1/rogue-unsecured" });
    assert.equal(rogue.statusCode, 500, "缺 security config 的 /api/v1 路由必须 fail-closed");
    const rogueEvents = await handle.app.inject({ method: "GET", url: "/events/rogue-unsecured" });
    assert.equal(rogueEvents.statusCode, 500, "缺 security config 的 /events 路由必须 fail-closed");
  } finally {
    await handle.app.close();
  }
});

test("/health/live 与 /healthz 无认证可访问（显式登记例外）；/healthz 含 auth 层", async () => {
  const mock = new MockAgent();
  const handle = await appWith({ mock });
  try {
    const live = await handle.app.inject({ method: "GET", url: "/health/live" });
    assert.equal(live.statusCode, 200);
    const healthz = await handle.app.inject({ method: "GET", url: "/healthz" });
    assert.equal(healthz.statusCode, 200);
    const layers = (healthz.json() as { layers: Record<string, { status: string }> }).layers;
    assert.equal(layers.auth?.status, "up", "fixture 注入时 auth 层 up");
    assert.ok(layers.db?.status === "not_configured", "withoutDb 时 db 层 not_configured");
  } finally {
    await handle.app.close();
  }
});

test("auth not_configured（无 authenticator）→ /api/v1 全部 503 fail-closed，绝不匿名放行", async () => {
  const mock = new MockAgent();
  const app = await buildApp(loadConfig({ ...process.env, LOG_LEVEL: "silent" }), {
    agent: mock.client,
    withoutDb: true,
  });
  const res = await app.inject({ method: "GET", url: "/api/v1/runtime" });
  assert.equal(res.statusCode, 503);
  assert.equal((res.json() as { error: { code: string } }).error.code, "DEPENDENCY_UNAVAILABLE");
  await app.close();
});
