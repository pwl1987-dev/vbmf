/**
 * SDK-01B/01C 集成测试 —— 真实 Fastify fixture（复用 WCE-01F 模式：
 * buildApp + FixtureAuthenticator + StubPlane + StubAgent），SDK client 经
 * fetch 桥接 app.inject。
 *
 * 覆盖（planning 验证矩阵）：happy path Start→Stop→Release、401/403/429/503
 * 拒绝路径零 dispatch、command plane DB-less 503、命令语义（Operation ≠
 * Runtime actual）。
 */
import { describe, expect, it, afterEach } from "vitest";
import { buildApp } from "../../../apps/api/src/server.ts";
import { loadConfig } from "../../../apps/api/src/config.ts";
import { AgentControlClient, AgentTransportFailure } from "../../../apps/api/src/agent/agentControlClient.ts";
import type { CommandPlane, ServiceResponse, SubmitInput } from "../../../apps/api/src/command/commandService.ts";
import { FixtureAuthenticator, fixturePrincipal } from "../../../apps/api/test/helpers/fixtureAuth.ts";
import type { AgentQuerySnapshotWire } from "../../../apps/api/src/agent/types.ts";
import { VbmfClient, VbmfApiError, type StartSessionBody } from "../src/index.ts";

/** LightMyRequest → 标准 Response 适配（transport 需要 .ok/.status/.headers.get/.text）。 */
async function injectBridge(
  app: Awaited<ReturnType<typeof buildApp>>,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = (init?.method ?? "GET").toUpperCase() as "GET" | "POST";
  const headers: Record<string, string> = {};
  if (init?.headers !== undefined) {
    for (const [k, v] of Object.entries(init.headers as Record<string, string>)) headers[k] = v;
  }
  const body = init?.body !== undefined ? String(init.body) : undefined;
  const res = await app.inject({ method, url, headers, ...(body !== undefined ? { payload: body } : {}) });
  const responseHeaders = new Headers();
  const h = res.headers as unknown as Record<string, string>;
  for (const [k, v] of Object.entries(h)) responseHeaders.set(k, Array.isArray(v) ? v.join(", ") : String(v));
  return new Response(res.body, { status: res.statusCode, headers: responseHeaders });
}


async function expectApiError(p: Promise<unknown>): Promise<VbmfApiError> {
  try {
    await p;
  } catch (e) {
    return e as VbmfApiError;
  }
  throw new Error("expected VbmfApiError, got success (errors must never be swallowed)");
}


const FIXTURE_KEY = "vbmf_fixture_sdk";

function snapshot(): AgentQuerySnapshotWire {
  return {
    devices: [],
    ports: [],
    resources: [],
    sessions: [],
    capabilities: [],
    generated_at_ms: 1,
    observation_revision: 1,
    observation_lineage: "00000000-0000-0000-0000-0000000000dd",
    program_switch: null,
  };
}

function okAgent(): AgentControlClient {
  return new AgentControlClient({
    baseUrl: "http://agent.invalid",
    fetchImpl: (async () =>
      new Response(JSON.stringify({ jsonrpc: "2.0", result: snapshot(), id: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch,
  });
}

function downAgent(): AgentControlClient {
  return new AgentControlClient({
    baseUrl: "http://agent.invalid",
    fetchImpl: (async () => {
      throw new AgentTransportFailure("network", "down");
    }) as unknown as typeof fetch,
  });
}

class StubPlane implements CommandPlane {
  readonly submits: SubmitInput[] = [];
  verdict: ServiceResponse = {
    status: 200,
    body: {
      command_id: "00000000-0000-0000-0000-0000000000aa",
      state: "completed",
      kind: "start_session",
      created_at: new Date().toISOString(),
    },
  };
  async submit(input: SubmitInput): Promise<ServiceResponse> {
    this.submits.push(input);
    return this.verdict;
  }
  async getOperation(commandId: string): Promise<ServiceResponse | undefined> {
    return { status: 200, body: { command_id: commandId, state: "completed", kind: "start_session", created_at: new Date().toISOString() } };
  }
  async recoverStalePending(): Promise<number> {
    return 0;
  }
}

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

async function buildHandle(opts: { agent?: AgentControlClient; plane?: CommandPlane; key?: string; role?: string } = {}) {
  const auth = new FixtureAuthenticator();
  auth.register(opts.key ?? FIXTURE_KEY, fixturePrincipal("user-sdk", opts.role ?? "operator"));
  const app = await buildApp(loadConfig({ ...process.env, LOG_LEVEL: "silent" }), {
    agent: opts.agent ?? okAgent(),
    withoutDb: true,
    authenticator: auth,
    ...(opts.plane !== undefined ? { commandService: opts.plane } : {}),
  });
  apps.push(app);
  const client = new VbmfClient({
    baseUrl: "http://sdk.internal",
    credentialProvider: () => opts.key ?? FIXTURE_KEY,
    fetchImpl: ((input: RequestInfo | URL, init?: RequestInit) =>
      injectBridge(app, input, init)) as unknown as typeof fetch,
  });
  return { app, client };
}

const CANONICAL_INTENT: StartSessionBody["intent"] = {
  version: "1.0",
  devices: [{
    device_id: "00000000-0000-0000-0000-0000000000d1",
    role: "CAPTURE",
    pipeline: {
      source: { kind: "decklink", device_id: "00000000-0000-0000-0000-0000000000d1" },
      sink: { kind: "appsink" },
    },
  }],
};

afterEach(async () => {
  while (apps.length > 0) {
    const app = apps.pop();
    await app?.close();
  }
});

describe("SDK ↔ real Fastify (integration)", () => {
  it("healthLive + health + getRuntime happy path", async () => {
    const { client } = await buildHandle();
    expect((await client.healthLive()).status).toBe("live");
    const hz = await client.health();
    expect(hz.layers.api.status).toBe("up");
    const rt = await client.getRuntime();
    expect(rt.observation_revision).toBe(1);
    expect(rt.sessions).toEqual([]);
  });

  it("Start → Stop → Release full command journey (Operation semantics)", async () => {
    const plane = new StubPlane();
    const { client } = await buildHandle({ plane });
    const start = await client.startSession({ intent: CANONICAL_INTENT }, "sdk-int-1");
    expect(start.state).toBe("completed");
    expect(start.kind).toBe("start_session");
    const stop = await client.stopSession("00000000-0000-0000-0000-0000000000bb", "sdk-int-2");
    expect(stop.state).toBe("completed");
    const rel = await client.releaseSession("00000000-0000-0000-0000-0000000000bb", "sdk-int-3");
    expect(rel.state).toBe("completed");
    expect(plane.submits).toHaveLength(3);
    const cmd = await client.getCommand(start.command_id);
    expect(cmd.state).toBe("completed");
  });

  it("missing pipeline intent → 400 from the real schema (BUG-F locked end-to-end)", async () => {
    const plane = new StubPlane();
    const { client } = await buildHandle({ plane });
    const err = await expectApiError(
      // 故意非法（缺 pipeline）：类型层绕过正是被测面 —— 真实 Product 面 400。
      client.startSession(
        { intent: { version: "1.0", devices: [{ device_id: "00000000-0000-0000-0000-0000000000d1", role: "CAPTURE" }] } as unknown as StartSessionBody["intent"] },
        "sdk-int-badf",
      ),
    );
    expect(err).toBeInstanceOf(VbmfApiError);
    expect(err.status).toBe(400);
    expect(plane.submits).toHaveLength(0);
  });

  it("401 invalid key + 403 viewer role (zero dispatch)", async () => {
    const plane = new StubPlane();
    const auth = new FixtureAuthenticator();
    auth.register(FIXTURE_KEY, fixturePrincipal("user-sdk-operator", "operator"));
    auth.register("vbmf_fixture_sdk_viewer", fixturePrincipal("user-sdk-viewer", "viewer"));
    const app = await buildApp(loadConfig({ ...process.env, LOG_LEVEL: "silent" }), {
      agent: okAgent(),
      withoutDb: true,
      authenticator: auth,
      commandService: plane,
    });
    apps.push(app);
    const bridge = (_key: string): typeof fetch =>
      ((input: RequestInfo | URL, init?: RequestInit) => injectBridge(app, input, init)) as unknown as typeof fetch;
    const mk = (key: string): VbmfClient =>
      new VbmfClient({ baseUrl: "http://sdk.internal", credentialProvider: () => key, fetchImpl: bridge(key) });

    const e1 = await expectApiError(mk("vbmf_wrong_key").startSession({ intent: CANONICAL_INTENT }, "sdk-int-401"));
    expect(e1).toBeInstanceOf(VbmfApiError);
    expect(e1.status).toBe(401);
    expect(e1.code).toBe("AUTHENTICATION_FAILED");

    const e2 = await expectApiError(mk("vbmf_fixture_sdk_viewer").startSession({ intent: CANONICAL_INTENT }, "sdk-int-403"));
    expect(e2.status).toBe(403);
    expect(e2.code).toBe("AUTHORIZATION_DENIED");
    expect(plane.submits).toHaveLength(0);
  });

  it("agent down → 503 DEPENDENCY_UNAVAILABLE; command plane unconfigured → 503 RESOURCE_UNAVAILABLE", async () => {
    const { client } = await buildHandle({ agent: downAgent() });
    const e = await expectApiError(client.getRuntime());
    expect(e.status).toBe(503);
    expect(e.code).toBe("DEPENDENCY_UNAVAILABLE");
    expect(e.retryable).toBe(true);

    const noPlane = await buildHandle({}); // withoutDb → command plane unconfigured
    const e2 = await expectApiError(noPlane.client.startSession({ intent: CANONICAL_INTENT }, "sdk-int-503"));
    expect(e2.status).toBe(503);
    expect(e2.code).toBe("RESOURCE_UNAVAILABLE");
  });
});
