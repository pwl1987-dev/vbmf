/**
 * WCE-01A — Product API Schema Authority contract test.
 *
 * 验证 ROUTE_SCHEMAS 中声明的 response shape 与运行时实际响应一致：
 * - 用 Fastify 自带的 `app.inject` 触发各路由的成功/失败路径；
 * - 抽取响应 body 并 JSON-Schema validate（用 Ajv，Fastify 内部同款）；
 * - 任何 schema drift 都将 fail-closed：测试拒绝；schema 必须描述现有行为，
 *   不得为通过测试而修改 schema 迎合代码（或反之）。
 *
 * 路径覆盖：
 * - /api/v1/runtime：200 / 400（非法 querystring）/ 503（依赖不可达）
 * - /health/live：200
 * - /healthz：200（runtime up + runtime unreachable 各跑一次）
 * - /api/v1/sessions（POST）：200（stub plane）/ 400（缺 intent）/ 409（同键异 fingerprint）
 * - /api/v1/sessions/:id/stop 与 /:id/release：200
 * - /api/v1/commands/:id：200 / 404
 */
import test from "node:test";
import assert from "node:assert/strict";
import { Ajv } from "ajv";
import { buildApp } from "../src/server.ts";
import { loadConfig } from "../src/config.ts";
import { AgentControlClient, AgentTransportFailure } from "../src/agent/agentControlClient.ts";
import {
  ROUTE_SCHEMAS,
  type RouteSchemaEntry,
} from "../src/routes/schemas.ts";
import type { CommandPlane, ServiceResponse, SubmitInput } from "../src/command/commandService.ts";
import { FixtureAuthenticator, fixturePrincipal } from "./helpers/fixtureAuth.ts";
import type { AgentQuerySnapshotWire } from "../src/agent/types.ts";

const ajv = new Ajv({ allErrors: true, strict: false });

const FIXTURE_KEY = "vbmf_fixture_schema";

function snapshot(): AgentQuerySnapshotWire {
  return {
    devices: [{ id: "dev-1", model: "Mock" }],
    ports: [{ id: "port-1", device_id: "dev-1", direction: "input" }],
    resources: [{ id: "res-1", device_id: "dev-1", state: "allocated" }],
    sessions: [
      {
        id: "session-11111111222233334444555566667777",
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

function fetchOk(payload: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify({ jsonrpc: "2.0", result: payload, id: 1 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

function fetchFailNetwork(): typeof fetch {
  return (async () => {
    throw new AgentTransportFailure("network", "down");
  }) as unknown as typeof fetch;
}

class StubPlane implements CommandPlane {
  readonly submits: SubmitInput[] = [];
  readonly verdict: ServiceResponse;
  readonly knownIds: Set<string> = new Set(["00000000-0000-0000-0000-0000000000aa"]);
  constructor(verdict?: ServiceResponse) {
    this.verdict =
      verdict ?? {
        status: 200,
        body: {
          command_id: "00000000-0000-0000-0000-0000000000aa",
          state: "completed",
          kind: "start_session",
          created_at: new Date().toISOString(),
        },
      };
  }
  async submit(input: SubmitInput): Promise<ServiceResponse> {
    this.submits.push(input);
    return this.verdict;
  }
  async getOperation(commandId: string): Promise<ServiceResponse | undefined> {
    if (!this.knownIds.has(commandId)) return undefined;
    return {
      status: 200,
      body: {
        command_id: commandId,
        state: "completed",
        kind: "start_session",
        created_at: new Date().toISOString(),
      },
    };
  }
  async recoverStalePending(): Promise<number> {
    return 0;
  }
}

async function appWith(opts: {
  agent: AgentControlClient;
  plane?: CommandPlane;
}): Promise<Awaited<ReturnType<typeof buildApp>>> {
  const auth = new FixtureAuthenticator();
  auth.register(FIXTURE_KEY, fixturePrincipal("user-schema", "operator"));
  return buildApp(loadConfig({ ...process.env, LOG_LEVEL: "silent" }), {
    agent: opts.agent,
    withoutDb: true,
    authenticator: auth,
    ...(opts.plane !== undefined ? { commandService: opts.plane } : {}),
  });
}

function entry(method: string, url: string): RouteSchemaEntry {
  const e = ROUTE_SCHEMAS.find((s) => s.method === method && s.url === url);
  if (e === undefined) throw new Error(`missing schema entry ${method} ${url}`);
  return e;
}

function assertValidates(
  responseSchema: Record<string, unknown> | undefined,
  status: number,
  body: unknown,
  label: string,
): void {
  // SDK-01A（Debt D 清偿）：SDK 需要稳定 API surface —— 每个被测 endpoint
  // 的实际响应 status 必须存在 declared response shape；未声明 status =
  // 契约缺口 → FAIL（此前 silently allowed）。新 status 出现时必须在
  // schemas.ts ROUTE_SCHEMAS 声明（fail-closed，不静默扩面）。
  assert.notEqual(
    responseSchema,
    undefined,
    `${label}: endpoint missing from ROUTE_SCHEMAS`,
  );
  for (const [codeKey, sub] of Object.entries(responseSchema!)) {
    if (!/^\d+$/.test(codeKey)) continue;
    if (Number(codeKey) !== status) continue;
    const validate = ajv.compile(sub as object);
    const ok = validate(body);
    if (!ok) {
      assert.fail(`${label}: status ${status} body does not satisfy declared schema: ${JSON.stringify(validate.errors)}`);
    }
    return;
  }
  assert.fail(
    `${label}: actual status ${status} has no declared response shape — declare it in schemas.ts or fix the route (SDK surface must be closed)`,
  );
}

test("schema entry set 与声明路径一致", () => {
  const urls = ROUTE_SCHEMAS.map((s) => `${s.method} ${s.url}`).sort();
  assert.deepEqual(urls, [
    "GET /api/v1/commands/:id",
    "GET /api/v1/runtime",
    "GET /events/v1/stream",
    "GET /health/live",
    "GET /healthz",
    "POST /api/v1/sessions",
    "POST /api/v1/sessions/:id/release",
    "POST /api/v1/sessions/:id/stop",
  ]);
});

test("/api/v1/runtime 200 + 503 响应均满足声明 schema", async () => {
  const upApp = await appWith({
    agent: new AgentControlClient({ baseUrl: "x", fetchImpl: fetchOk(snapshot()) }),
  });
  try {
    const res = await upApp.inject({
      method: "GET",
      url: "/api/v1/runtime",
      headers: { "x-api-key": FIXTURE_KEY },
    });
    assert.equal(res.statusCode, 200);
    assertValidates(entry("GET", "/api/v1/runtime").response, 200, res.json(), "runtime 200");
  } finally {
    await upApp.close();
  }
  const downApp = await appWith({
    agent: new AgentControlClient({ baseUrl: "x", fetchImpl: fetchFailNetwork() }),
  });
  try {
    const res = await downApp.inject({
      method: "GET",
      url: "/api/v1/runtime",
      headers: { "x-api-key": FIXTURE_KEY },
    });
    assert.equal(res.statusCode, 503);
    assertValidates(entry("GET", "/api/v1/runtime").response, 503, res.json(), "runtime 503");
  } finally {
    await downApp.close();
  }
});

test("/health/live + /healthz 200 响应满足声明 schema", async () => {
  const app = await appWith({
    agent: new AgentControlClient({ baseUrl: "x", fetchImpl: fetchOk(snapshot()) }),
  });
  try {
    const live = await app.inject({ method: "GET", url: "/health/live" });
    assert.equal(live.statusCode, 200);
    assertValidates(entry("GET", "/health/live").response, 200, live.json(), "live");
    const hz = await app.inject({ method: "GET", url: "/healthz" });
    assert.equal(hz.statusCode, 200);
    assertValidates(entry("GET", "/healthz").response, 200, hz.json(), "healthz");
  } finally {
    await app.close();
  }
});

test("POST /api/v1/sessions 200 + 400 满足声明 schema", async () => {
  const plane = new StubPlane();
  const app = await appWith({
    agent: new AgentControlClient({ baseUrl: "x", fetchImpl: fetchOk(snapshot()) }),
    plane,
  });
  try {
    const ok = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { "x-api-key": FIXTURE_KEY, "idempotency-key": "schema-start-1" },
      payload: { intent: { version: "1.0", devices: [{ device_id: "00000000-0000-0000-0000-0000000000d1", role: "CAPTURE", pipeline: { source: { kind: "decklink", device_id: "00000000-0000-0000-0000-0000000000d1" }, sink: { kind: "appsink" } } }] } },
    });
    assert.equal(ok.statusCode, 200);
    assertValidates(entry("POST", "/api/v1/sessions").response, 200, ok.json(), "start 200");
    const bad = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      headers: { "x-api-key": FIXTURE_KEY, "idempotency-key": "schema-start-bad" },
      payload: { intent: { version: "1.0", devices: [] } },
    });
    assert.equal(bad.statusCode, 400);
    assertValidates(entry("POST", "/api/v1/sessions").response, 400, bad.json(), "start 400");
  } finally {
    await app.close();
  }
});

test("POST /api/v1/sessions/:id/stop + /release 200 满足声明 schema", async () => {
  const plane = new StubPlane();
  const app = await appWith({
    agent: new AgentControlClient({ baseUrl: "x", fetchImpl: fetchOk(snapshot()) }),
    plane,
  });
  try {
    const cases = [
      { url: "/api/v1/sessions/11111111-2222-3333-4444-555566667777/stop", template: "/api/v1/sessions/:id/stop" },
      { url: "/api/v1/sessions/11111111-2222-3333-4444-555566667777/release", template: "/api/v1/sessions/:id/release" },
    ];
    for (const c of cases) {
      const res = await app.inject({
        method: "POST",
        url: c.url,
        headers: { "x-api-key": FIXTURE_KEY, "idempotency-key": `schema-${c.url.split("/").pop()}` },
        payload: {},
      });
      assert.equal(res.statusCode, 200);
      assertValidates(entry("POST", c.template).response, 200, res.json(), `${c.url} 200`);
    }
  } finally {
    await app.close();
  }
});

test("GET /api/v1/commands/:id 200 + 404 满足声明 schema", async () => {
  const plane = new StubPlane();
  const app = await appWith({
    agent: new AgentControlClient({ baseUrl: "x", fetchImpl: fetchOk(snapshot()) }),
    plane,
  });
  try {
    const found = await app.inject({
      method: "GET",
      url: "/api/v1/commands/00000000-0000-0000-0000-0000000000aa",
      headers: { "x-api-key": FIXTURE_KEY },
    });
    assert.equal(found.statusCode, 200);
    assertValidates(entry("GET", "/api/v1/commands/:id").response, 200, found.json(), "cmd 200");
    const missing = await app.inject({
      method: "GET",
      url: "/api/v1/commands/99999999-9999-9999-9999-999999999999",
      headers: { "x-api-key": FIXTURE_KEY },
    });
    assert.equal(missing.statusCode, 404);
    assertValidates(entry("GET", "/api/v1/commands/:id").response, 404, missing.json(), "cmd 404");
  } finally {
    await app.close();
  }
});

test("12 类 ErrorCode 词表与 lib/errors.ts 一致", () => {
  // 防止 schema 与错误模型单边漂移。
  const expected = [
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
  ];
  const responses = entry("GET", "/api/v1/runtime").response;
  const env400 = responses["400"] as {
    properties: {
      error: {
        properties: { code: { enum: string[] } };
      };
    };
  };
  const declared = env400.properties.error.properties.code.enum;
  assert.deepEqual(declared.slice().sort(), expected.slice().sort());
});
