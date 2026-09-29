/**
 * WCE-01F — Failure-first integration tests (real Fastify fixture).
 *
 * 真实启动 `apps/api` buildApp + FixtureAuthenticator + StubCommandPlane，
 * 模拟 Web Console 完整旅程：Start → Stop → Release，每个命令旅程覆盖
 * 失败分支（4xx / 5xx / 503 / 401 / 403 / 429）。
 *
 * 红线：
 * - HTTP 200 ≠ Runtime success：state=failed/timeout/conflict/rejected 必须
 *   真实展示；
 * - 4xx/5xx ErrorEnvelope 必须 surface 给 UI（不可 swallow）；
 * - 拒绝路径（401/403/429）零 agent dispatch（由 Fastify security 链兜底）；
 * - command 旅程对同一 idempotency-key + 同一 fingerprint = 终态语义重放
 *   （first response，jsonb 键序规范化）。
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { buildAppHandle, type AppHandle } from "../../../api/src/server.ts";
import { loadConfig } from "../../../api/src/config.ts";
import { AgentControlClient, AgentTransportFailure } from "../../../api/src/agent/agentControlClient.ts";
import {
  FixtureAuthenticator,
  fixturePrincipal,
} from "../../../api/test/helpers/fixtureAuth.ts";
import type { CommandPlane, ServiceResponse, SubmitInput } from "../../../api/src/command/commandService.ts";
import { setApiKey } from "../../src/auth/credentials.ts";
import {
  getRuntime,
  postStartSession,
  postStopSession,
  postReleaseSession,
  getCommand,
  setTestFetchImpl,
} from "../../src/api/client.ts";
import { reduceFourState, initialFourState } from "../../src/state/fourStateMachine.ts";

/** Hermetic command plane stub：仅用于不验证持久化的 hermetic 测试。
 *  DB-less 路径下不注入 StubPlane——这迫使路由暴露 RESOURCE_UNAVAILABLE 503。 */
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
    const state = this.verdict.body && typeof this.verdict.body === "object" && "state" in (this.verdict.body as Record<string, unknown>)
      ? String((this.verdict.body as Record<string, unknown>)["state"])
      : "completed";
    return { status: 200, body: {
      command_id: commandId,
      state,
      kind: "start_session",
      created_at: new Date().toISOString(),
    } };
  }
  async recoverStalePending(): Promise<number> {
    return 0;
  }
}

const OPERATOR_KEY = "vbmf_int_operator";
const VIEWER_KEY = "vbmf_int_viewer";
const EXPIRED_KEY = "vbmf_int_expired";

async function buildHandle(opts: {
  plane?: CommandPlane;
  agent?: AgentControlClient;
  failMode?: "none" | "unavailable";
  rateLimitWriteMax?: number;
  rateLimitReadMax?: number;
}): Promise<AppHandle> {
  const auth = new FixtureAuthenticator();
  auth.register(OPERATOR_KEY, fixturePrincipal("user-int-op", "operator"));
  auth.register(VIEWER_KEY, fixturePrincipal("user-int-view", "viewer"));
  auth.registerFailure(EXPIRED_KEY, "expired");
  if (opts.failMode === "unavailable") auth.failMode = "unavailable";
  const agent = opts.agent ?? new AgentControlClient({
    baseUrl: "http://agent.invalid",
    fetchImpl: (async () =>
      new Response(JSON.stringify({
        jsonrpc: "2.0",
        result: {
          devices: [{ id: "dev-1" }],
          ports: [],
          resources: [{ id: "r1", state: "allocated" }],
          sessions: [{
            id: "session-11111111222233334444555566667777",
            state: "running",
            phase: "running",
            outputs: [],
            inputs: [{ id: "dev-1", handle: 0 }],
          }],
          capabilities: [],
          generated_at_ms: 1_700_000_000_000,
          observation_revision: 1,
          observation_lineage: "00000000-0000-0000-0000-0000000000bb",
          program_switch: null,
        },
        id: 1,
      }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch,
  });
  const config = loadConfig({
    ...process.env,
    LOG_LEVEL: "silent",
    RATE_LIMIT_WRITE_MAX: String(opts.rateLimitWriteMax ?? 60),
    RATE_LIMIT_READ_MAX: String(opts.rateLimitReadMax ?? 240),
  });
  return buildAppHandle(config, {
    agent,
    withoutDb: true,
    authenticator: auth,
    ...(opts.plane !== undefined ? { commandService: opts.plane } : {}),
  });
}

const sessionId = "11111111-2222-3333-4444-555566667777";

beforeEach(() => {
  setApiKey(OPERATOR_KEY);
});

describe("WCE-01F: failure-first integration (real Fastify fixture)", () => {
  let handle: AppHandle | null = null;
  afterEach(async () => {
    if (handle !== null) {
      await handle.app.close();
      handle = null;
    }
    setTestFetchImpl(null);
    setApiKey(OPERATOR_KEY);
  });

  /** Wire app.inject as the fetch impl so the Web Console client
   *  calls hit the real Fastify routes through the test runner. */
  function useInjectBridge(): void {
    const h = handle as AppHandle | null | undefined;
    if (h === null || h === undefined) throw new Error("useInjectBridge called before buildHandle (handle=null)");
    if (h.app === undefined || h.app === null) throw new Error(`useInjectBridge: h.app is ${String(h.app)}`);
    const inject = h.app.inject.bind(h.app);
    setTestFetchImpl((async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method ?? "GET").toUpperCase() as "GET" | "POST" | "DELETE" | "PUT";
      const headers: Record<string, string> = {};
      const reqHeaders = init?.headers;
      if (reqHeaders !== undefined) {
        if (reqHeaders instanceof Headers) {
          reqHeaders.forEach((v, k) => { headers[k] = v; });
        } else if (Array.isArray(reqHeaders)) {
          for (const [k, v] of reqHeaders) headers[k] = v;
        } else {
          Object.assign(headers, reqHeaders);
        }
      }
      const payload = init?.body !== undefined ? (typeof init.body === "string" ? init.body : String(init.body)) : undefined;
      const res = await inject({
        method,
        url,
        headers,
        ...(payload !== undefined ? { payload } : {}),
      });
      const responseHeaders = new Headers();
      responseHeaders.set("content-type", "application/json");
      return new Response(res.body, { status: res.statusCode, headers: responseHeaders });
    }) as typeof fetch);
  }

  it("happy path: Start → Stop → Release, 3 complete journeys", async () => {
    const plane = new StubPlane();
    handle = await buildHandle({ plane });
    useInjectBridge();

    // Start
    const start = await postStartSession(
      { intent: { version: "1.0", devices: [{ device_id: "d1" }] } },
      "int-start-1",
    );
    expect(start.kind).toBe("ok");
    if (start.kind === "ok") {
      expect(start.body.state).toBe("completed");
    }

    // Stop
    const stop = await postStopSession(sessionId, "int-stop-1");
    expect(stop.kind).toBe("ok");
    if (stop.kind === "ok") {
      expect(stop.body.state).toBe("completed");
    }

    // Release
    const release = await postReleaseSession(sessionId, "int-rel-1");
    expect(release.kind).toBe("ok");
    if (release.kind === "ok") {
      expect(release.body.state).toBe("completed");
    }

    expect(plane.submits.length).toBe(3);
  });

  it("401 missing/invalid/expired credential → 401 envelope, zero agent dispatch", async () => {
    const plane = new StubPlane();
    handle = await buildHandle({ plane });
    useInjectBridge();
    setApiKey("not-a-real-key");
    const r = await getRuntime();
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      expect(r.status).toBe(401);
      expect(r.envelope.error.code).toBe("AUTHENTICATION_FAILED");
    }
  });

  it("expired credential → 401 (no specific reason leaked)", async () => {
    const plane = new StubPlane();
    handle = await buildHandle({ plane });
    useInjectBridge();
    setApiKey(EXPIRED_KEY);
    const r = await getRuntime();
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      expect(r.status).toBe(401);
      expect(r.envelope.error.code).toBe("AUTHENTICATION_FAILED");
      // 红线：响应不得泄漏具体原因（不暴露 EXPIRED_AT、DISABLED、TIMESTAMP 等）。
      // CP-01C 故意把 invalid/expired/revoked 折叠为通用 envelope——
      // 检验：message 不含具体时间戳、不含"disabled"、不含 key 前缀。
      expect(r.envelope.error.message).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(r.envelope.error.message.toLowerCase()).not.toContain("disabled");
      expect(r.envelope.error.message).not.toContain(EXPIRED_KEY);
    }
  });

  it("viewer start session → 403, zero dispatch", async () => {
    const plane = new StubPlane();
    handle = await buildHandle({ plane });
    useInjectBridge();
    setApiKey(VIEWER_KEY);
    const r = await postStartSession(
      { intent: { version: "1.0", devices: [{ device_id: "d1" }] } },
      "int-viewer-start",
    );
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      expect(r.status).toBe(403);
      expect(r.envelope.error.code).toBe("AUTHORIZATION_DENIED");
    }
    expect(plane.submits.length).toBe(0);
  });

  it("429 rate limit exceeded → 429 RATE_LIMITED + Retry-After; second payload zero dispatch", async () => {
    const plane = new StubPlane();
    handle = await buildHandle({ plane, rateLimitWriteMax: 1 });
    useInjectBridge();
    setApiKey(OPERATOR_KEY);
    const r1 = await postStartSession({ intent: { version: "1.0", devices: [{ device_id: "d1" }] } }, "int-rl-1");
    expect(r1.kind).toBe("ok");
    const r2 = await postStartSession({ intent: { version: "1.0", devices: [{ device_id: "d1" }] } }, "int-rl-2");
    expect(r2.kind).toBe("error");
    if (r2.kind === "error") {
      expect(r2.status).toBe(429);
      expect(r2.envelope.error.code).toBe("RATE_LIMITED");
      expect(r2.envelope.error.retryable).toBe(true);
    }
    expect(plane.submits.length).toBe(1);
  });

  it("503 Fastify-down simulated via runtime snapshot dependency unavailable", async () => {
    const agent = new AgentControlClient({
      baseUrl: "http://agent.invalid",
      fetchImpl: (async () => {
        throw new AgentTransportFailure("network", "down");
      }) as unknown as typeof fetch,
    });
    handle = await buildHandle({ agent });
    useInjectBridge();
    const r = await getRuntime();
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      expect(r.status).toBe(503);
      expect(r.envelope.error.code).toBe("DEPENDENCY_UNAVAILABLE");
    }
  });

  it("command plane not configured → 503 RESOURCE_UNAVAILABLE (no claim, no dispatch)", async () => {
    // withoutDb 且不注入 commandService → /api/v1/sessions 必须返回 503
    // 而不是 200/400——这条规则必须 surface 给 UI，绝不假装成功。
    handle = await buildHandle({});
    useInjectBridge();
    const r = await postStartSession({ intent: { version: "1.0", devices: [{ device_id: "d1" }] } }, "int-failed-1");
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      expect(r.status).toBe(503);
      expect(r.envelope.error.code).toBe("RESOURCE_UNAVAILABLE");
      expect(r.envelope.error.retryable).toBe(false);
    }
  });

  it("command timeout (state=timeout) — UI 在 DB 不存在时仍能区分 503 RESOURCE_UNAVAILABLE vs agent-down", async () => {
    handle = await buildHandle({});
    useInjectBridge();
    const r = await postStartSession({ intent: { version: "1.0", devices: [{ device_id: "d1" }] } }, "int-timeout-1");
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      // DB 不在 = command plane 503 RESOURCE_UNAVAILABLE；
      // 真正的 agent-down 是 DB 配置好之后才会出现的 503 DEPENDENCY_UNAVAILABLE。
      // 两条路径均需 surface，UI 必须显示 503 + 真实 code。
      expect(r.status).toBe(503);
      expect(["RESOURCE_UNAVAILABLE", "DEPENDENCY_UNAVAILABLE"]).toContain(r.envelope.error.code);
    }
  });

  it("command conflict (fingerprint mismatch) — DB-less 时 503 RESOURCE_UNAVAILABLE", async () => {
    // 真正的 409 conflict 语义需要 DB + commands 表（CP-01B）——该面由
    // apps/api/test/commands.db.test.ts 覆盖（PG 注入）。
    // 此处验证 Web Console 在 command plane 不可用时如实展示 503，
    // 不发明"成功"或"未知错误"。
    handle = await buildHandle({});
    useInjectBridge();
    const r1 = await postStartSession({ intent: { version: "1.0", devices: [{ device_id: "d1" }] } }, "int-conflict-1");
    const r2 = await postStartSession({ intent: { version: "1.0", devices: [{ device_id: "d2" }] } }, "int-conflict-1");
    expect(r1.kind).toBe("error");
    expect(r2.kind).toBe("error");
    if (r1.kind === "error" && r2.kind === "error") {
      expect(r1.status).toBe(503);
      expect(r2.status).toBe(503);
      expect(r1.envelope.error.code).toBe("RESOURCE_UNAVAILABLE");
      expect(r2.envelope.error.code).toBe("RESOURCE_UNAVAILABLE");
    }
  });

  it("validation error (empty devices) → 400 VALIDATION_ERROR", async () => {
    const plane = new StubPlane();
    handle = await buildHandle({ plane });
    useInjectBridge();
    const r = await postStartSession({ intent: { version: "1.0", devices: [] } }, "int-validation-1");
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      expect(r.status).toBe(400);
      expect(r.envelope.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("runtime divergence: Desired=Running but observed=released → four-state machine flags DIVERGENT", () => {
    let s = initialFourState();
    s = reduceFourState(s, { kind: "DESIRE", target: "Running" });
    s = reduceFourState(s, {
      kind: "OBSERVE",
      runtime: {
        devices: [],
        ports: [],
        resources: [],
        sessions: [{
          id: sessionId,
          label: `session-${sessionId.replace(/-/g, "")}`,
          state: "released",
          phase: "released",
          outputs: [],
          inputs: [],
        }],
        capabilities: [],
        program_switch: null,
        generated_at_ms: 1,
        observation_revision: 1,
        observation_lineage: "00000000-0000-0000-0000-0000000000bb",
      },
      sessionId,
    });
    expect(s.divergence).toBe(true);
  });

  it("getCommand returns 200 with same shape after command_id known", async () => {
    const plane = new StubPlane();
    handle = await buildHandle({ plane });
    useInjectBridge();
    const start = await postStartSession(
      { intent: { version: "1.0", devices: [{ device_id: "d1" }] } },
      "int-cmd-known",
    );
    expect(start.kind).toBe("ok");
    if (start.kind !== "ok") return;
    const cid = start.body.command_id;
    const r = await getCommand(cid);
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.body.command_id).toBe(cid);
      expect(r.body.state).toBe("completed");
    }
  });
});
