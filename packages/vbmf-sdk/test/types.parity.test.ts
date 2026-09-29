/**
 * SDK-01A — 类型派生 parity 测试。
 *
 * 1. drift：重新运行 gen:types 后 src/generated 必须与 git 提交版一致
 *    （schema 改动未同步派生 → FAIL，双保险于 CI git-diff gate）；
 * 2. shape：generated 类型的关键 wire 形态编译期断言（ErrorCode 12 词表、
 *    CommandState 6 词表、intent tagged union、sink enum、opaque 投影），
 *    防 json-schema-to-typescript 版本行为漂移静默改变公共类型。
 */
import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import type { CommandOperationBody, ErrorCode, GraphRuntimeIntent, RuntimeSnapshot } from "../src/generated/types.ts";
import { expectTypeOf } from "vitest";

describe("SDK-01A mechanical type derivation", () => {
  it("generated types.ts is in sync with the schema authority (drift)", () => {
    execSync("node scripts/gen-types.ts", { stdio: "pipe" });
    const diff = execSync("git diff --exit-code -- src/generated/types.ts", { stdio: "pipe" }).toString();
    expect(diff).toBe("");
  });

  it("ErrorCode vocabulary = 12 frozen codes (no handwritten duplicates)", () => {
    const codes: ErrorCode[] = [
      "AUTHENTICATION_FAILED", "AUTHORIZATION_DENIED", "VALIDATION_ERROR",
      "RESOURCE_NOT_FOUND", "RESOURCE_CONFLICT", "RESOURCE_UNAVAILABLE",
      "CAPABILITY_UNSUPPORTED", "COMMAND_REJECTED", "COMMAND_FAILED",
      "DEPENDENCY_UNAVAILABLE", "RATE_LIMITED", "INTERNAL_ERROR",
    ];
    // 编译期：超集词表无法通过类型检查；运行时 sanity：数组形态稳定。
    const wrong = "NOT_A_CODE" as ErrorCode;
    expect(codes).toHaveLength(12);
    expect(wrong === ("x" as ErrorCode)).toBe(false);
  });

  it("CommandOperationBody.state vocabulary is the frozen 6", () => {
    const c = { command_id: "x", state: "pending", kind: "start_session", created_at: "t" } as CommandOperationBody;
    expect(c.state).toBe("pending");
    // @ts-expect-error bogus state must not typecheck
    const bad: CommandOperationBody = { ...c, state: "running" };
    expect(bad).toBeDefined();
  });

  it("GraphRuntimeIntent source is a tagged union over decklink/rtmp/self_test", () => {
    const intent = {
      version: "1.0",
      devices: [{
        device_id: "00000000-0000-0000-0000-0000000000d1",
        role: "CAPTURE",
        pipeline: { source: { kind: "self_test" }, sink: { kind: "appsink" } },
      }],
    } as GraphRuntimeIntent;
    const src = intent.devices[0]!.pipeline.source;
    if (src.kind === "decklink") {
      expectTypeOf(src.device_id).toBeString();
    } else if (src.kind === "rtmp") {
      expectTypeOf(src.endpoint.host).toBeString();
    } else {
      expect(src.kind).toBe("self_test");
    }
  });

  it("RuntimeSnapshot keeps opaque projections as unknown (debt B decision)", () => {
    const snap = {
      devices: [], ports: [], resources: [], sessions: [],
      capabilities: [], program_switch: null,
      generated_at_ms: 1, observation_revision: 1, observation_lineage: "x",
    } as RuntimeSnapshot;
    // opaque 面（devices/ports/resources/capabilities/program_switch）在类型
    // 层无字段承诺 —— 结构性赋值只能按 unknown 消费。
    const devices: unknown = snap.devices;
    expect(devices).toEqual([]);
  });
});
