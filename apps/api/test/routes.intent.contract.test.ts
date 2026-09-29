/**
 * SDK-01A — GraphRuntimeIntent wire closure contract test（failure-first）。
 *
 * BMD BUG-F 实证（2026-09-29 · evidence/2026-09-29-web-console-bmd-acceptance）：
 * Product API schema 只要求 intent.version + devices[] 非空，而 Rust
 * graph_intent.rs 冻结 wire 要求 devices[].pipeline = {source, sink} ——
 * 缺 pipeline 的请求曾被 schema 接受、被 command persistence 接受，最后被
 * 真实 media-agent 以 invalid_intent 拒绝（HTTP 表现 503，PG 记
 * timeout|retryable，污染命令审计面）。
 *
 * 本测试机械锁死：intent 契约缺口必须在 Fastify 层被 400 拦截，
 * 且零 command submit / 零 dispatch（失败不得穿透到命令面）。
 *
 * wire authority = services/media-agent/src/graph_intent.rs（serde）+
 * pipeline.rs sink 词表快照测试（appsink/hls/rtmp 受纳，其余 fail-closed）。
 * 本测试不发明 schema，只验证 Product JSON Schema 与该 wire 一致。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/server.ts";
import { loadConfig } from "../src/config.ts";
import { AgentControlClient } from "../src/agent/agentControlClient.ts";
import type { CommandPlane, ServiceResponse, SubmitInput } from "../src/command/commandService.ts";
import { FixtureAuthenticator, fixturePrincipal } from "./helpers/fixtureAuth.ts";
import type { AgentQuerySnapshotWire } from "../src/agent/types.ts";

const FIXTURE_KEY = "vbmf_fixture_intent";

function snapshot(): AgentQuerySnapshotWire {
  return {
    devices: [],
    ports: [],
    resources: [],
    sessions: [],
    capabilities: [],
    generated_at_ms: 1,
    observation_revision: 1,
    observation_lineage: "00000000-0000-0000-0000-0000000000cc",
    program_switch: null,
  };
}

function fetchOk(): typeof fetch {
  return (async () =>
    new Response(JSON.stringify({ jsonrpc: "2.0", result: snapshot(), id: 1 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

class CountingPlane implements CommandPlane {
  readonly submits: SubmitInput[] = [];
  async submit(input: SubmitInput): Promise<ServiceResponse> {
    this.submits.push(input);
    return {
      status: 200,
      body: {
        command_id: "00000000-0000-0000-0000-0000000000aa",
        state: "completed",
        kind: "start_session",
        created_at: new Date().toISOString(),
      },
    };
  }
  async getOperation(): Promise<ServiceResponse | undefined> {
    return undefined;
  }
  async recoverStalePending(): Promise<number> {
    return 0;
  }
}

async function appWithPlane(plane: CommandPlane): Promise<{ app: Awaited<ReturnType<typeof buildApp>>; plane: CommandPlane }> {
  const auth = new FixtureAuthenticator();
  auth.register(FIXTURE_KEY, fixturePrincipal("user-intent", "operator"));
  const app = await buildApp(loadConfig({ ...process.env, LOG_LEVEL: "silent" }), {
    agent: new AgentControlClient({ baseUrl: "x", fetchImpl: fetchOk() }),
    withoutDb: true,
    authenticator: auth,
    commandService: plane,
  });
  return { app, plane };
}

const DEVICE = "4fa33dcb-5f76-5f76-aea8-330df7ada03e";

function postIntent(app: Awaited<ReturnType<typeof buildApp>>, intent: unknown) {
  return app.inject({
    method: "POST",
    url: "/api/v1/sessions",
    headers: { "x-api-key": FIXTURE_KEY, "content-type": "application/json", "idempotency-key": `it-${Math.random()}` },
    payload: { intent },
  });
}

test("missing devices[].pipeline → 400 + zero submit（BUG-F 类缺陷不得穿透命令面）", async () => {
  const { app, plane } = await appWithPlane(new CountingPlane());
  try {
    const res = await postIntent(app, {
      version: "1.0",
      devices: [{ device_id: DEVICE, role: "CAPTURE" }],
    });
    assert.equal(res.statusCode, 400, `expected 400, body=${res.body}`);
    assert.equal((plane as CountingPlane).submits.length, 0, "must not reach command plane");
  } finally {
    await app.close();
  }
});

test("invalid source kind → 400 + zero submit", async () => {
  const { app, plane } = await appWithPlane(new CountingPlane());
  try {
    const res = await postIntent(app, {
      version: "1.0",
      devices: [{
        device_id: DEVICE,
        role: "CAPTURE",
        pipeline: { source: { kind: "sdi", device_id: DEVICE }, sink: { kind: "appsink" } },
      }],
    });
    assert.equal(res.statusCode, 400);
    assert.equal((plane as CountingPlane).submits.length, 0);
  } finally {
    await app.close();
  }
});

test("source kind present but missing required field (decklink without device_id) → 400", async () => {
  const { app } = await appWithPlane(new CountingPlane());
  try {
    const res = await postIntent(app, {
      version: "1.0",
      devices: [{
        device_id: DEVICE,
        role: "CAPTURE",
        pipeline: { source: { kind: "decklink" }, sink: { kind: "appsink" } },
      }],
    });
    assert.equal(res.statusCode, 400);
  } finally {
    await app.close();
  }
});

test("sink kind outside vocabulary (bogus) → 400；词表 = appsink/hls/rtmp（pipeline.rs 快照）", async () => {
  const { app, plane } = await appWithPlane(new CountingPlane());
  try {
    for (const kind of ["bogus", "", "file", "rtsp", "RTMP"]) {
      const res = await postIntent(app, {
        version: "1.0",
        devices: [{
          device_id: DEVICE,
          role: "CAPTURE",
          pipeline: { source: { kind: "decklink", device_id: DEVICE }, sink: { kind } },
        }],
      });
      assert.equal(res.statusCode, 400, `sink kind ${JSON.stringify(kind)} must be rejected`);
    }
    assert.equal((plane as CountingPlane).submits.length, 0);
  } finally {
    await app.close();
  }
});

test("rtmp source missing endpoint.host → 400（NetworkEndpoint 冻结 wire）", async () => {
  const { app } = await appWithPlane(new CountingPlane());
  try {
    const res = await postIntent(app, {
      version: "1.0",
      devices: [{
        device_id: DEVICE,
        role: "CAPTURE",
        pipeline: {
          source: {
            kind: "rtmp",
            source_id: "00000000-0000-0000-0000-000000000001",
            endpoint: { protocol: "rtmp", port: 1935, path: "/live/in" },
          },
          sink: { kind: "rtmp" },
        },
      }],
    });
    assert.equal(res.statusCode, 400);
  } finally {
    await app.close();
  }
});

test("valid decklink capture intent → 200 accepted（wire parity with graph_intent.rs SAMPLE + BUG-F fix）", async () => {
  const { app, plane } = await appWithPlane(new CountingPlane());
  try {
    const res = await postIntent(app, {
      version: "1.0",
      devices: [{
        device_id: DEVICE,
        role: "CAPTURE",
        pipeline: {
          source: { kind: "decklink", device_id: DEVICE },
          sink: { kind: "appsink" },
        },
      }],
    });
    assert.equal(res.statusCode, 200, `body=${res.body}`);
    assert.equal((plane as CountingPlane).submits.length, 1);
  } finally {
    await app.close();
  }
});

test("valid rtmp source intent → 200 accepted（frozen wire 支持）", async () => {
  const { app } = await appWithPlane(new CountingPlane());
  try {
    const res = await postIntent(app, {
      version: "1.0",
      devices: [{
        device_id: DEVICE,
        role: "CAPTURE",
        pipeline: {
          source: {
            kind: "rtmp",
            source_id: "00000000-0000-0000-0000-000000000002",
            endpoint: { protocol: "rtmp", host: "127.0.0.1", port: 1935, path: "/live/input" },
          },
          sink: { kind: "rtmp" },
        },
      }],
    });
    assert.equal(res.statusCode, 200, `body=${res.body}`);
  } finally {
    await app.close();
  }
});

test("valid self_test source intent → 200 accepted（kind-only wire form）", async () => {
  const { app } = await appWithPlane(new CountingPlane());
  try {
    const res = await postIntent(app, {
      version: "1.0",
      devices: [{
        device_id: DEVICE,
        role: "CAPTURE",
        pipeline: { source: { kind: "self_test" }, sink: { kind: "appsink" } },
      }],
    });
    assert.equal(res.statusCode, 200, `body=${res.body}`);
  } finally {
    await app.close();
  }
});

test("execution-detail 字段（device_number/handle/媒体进程 argv）在 intent 内 → 400（vendor-neutral 红线）", async () => {
  const { app, plane } = await appWithPlane(new CountingPlane());
  try {
    const res = await postIntent(app, {
      version: "1.0",
      devices: [{
        device_id: DEVICE,
        role: "CAPTURE",
        pipeline: { source: { kind: "decklink", device_id: DEVICE }, sink: { kind: "appsink" } },
        device_number: 2,
      }],
    });
    assert.equal(res.statusCode, 400, "additionalProperties:false must reject execution-detail fields");
    assert.equal((plane as CountingPlane).submits.length, 0);
  } finally {
    await app.close();
  }
});
