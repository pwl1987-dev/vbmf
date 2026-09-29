/**
 * Canonical start-intent wire guard（WEB-CONSOLE-BMD-ACCEPTANCE-01）。
 *
 * BMD 真机实证（2026-09-29）：缺 devices[].pipeline 的最小 intent 被真实
 * media-agent 以 `invalid_intent: missing field "pipeline"` 拒绝（HTTP 层
 * 表现为 503 DEPENDENCY_UNAVAILABLE · PG 记 timeout|retryable）。本 guard
 * 机械锁定 Web Console 发出的 intent 满足 Rust graph_intent.rs 冻结 wire。
 */
import { describe, expect, it } from "vitest";
import { buildDecklinkCaptureIntent } from "../src/api/intent.ts";

describe("buildDecklinkCaptureIntent", () => {
  it("emits the canonical GraphRuntimeIntent wire shape", () => {
    const intent = buildDecklinkCaptureIntent("4fa33dcb-5f76-5f76-aea8-330df7ada03e");
    expect(intent.version).toBe("1.0");
    expect(intent.devices).toHaveLength(1);
    const d = intent.devices[0]!;
    expect(d.device_id).toBe("4fa33dcb-5f76-5f76-aea8-330df7ada03e");
    expect(d.role).toBe("CAPTURE");
    // pipeline 为必填键——这是 BMD 实证被拒的根因，禁止回归为最小 intent。
    expect(Object.keys(d)).toContain("pipeline");
    expect(d.pipeline.source.kind).toBe("decklink");
    expect(d.pipeline.source.device_id).toBe("4fa33dcb-5f76-5f76-aea8-330df7ada03e");
    expect(typeof d.pipeline.sink.kind).toBe("string");
  });

  it("round-trips through the Rust-canonical JSON sample structure", () => {
    const intent = buildDecklinkCaptureIntent("6ede00d0-baf4-573f-a0dd-4a503bf7f766");
    const json = JSON.parse(JSON.stringify(intent)) as {
      devices: Array<{ pipeline: { source: { kind: string }; sink: { kind: string } } }>;
    };
    // graph_intent.rs SAMPLE 的冻结键序/结构：source tagged by kind=decklink。
    expect(json.devices[0]!.pipeline.source.kind).toBe("decklink");
    expect(json.devices[0]!.pipeline.sink.kind).toBe("appsink");
  });

  it("never emits execution-detail fields (vendor-neutral red line)", () => {
    const intent = buildDecklinkCaptureIntent("1afe2dcc-6d85-5b46-b7d6-e14102501c77");
    const flat = JSON.stringify(intent);
    for (const banned of ["device_number", "gst", "handle", "backend", "ffmpeg", "/dev/"]) {
      expect(flat).not.toContain(banned);
    }
  });
});
