/**
 * Canonical GraphRuntimeIntent builder（WEB-CONSOLE-BMD-ACCEPTANCE-01 RCA 修复）。
 *
 * 永久边界：
 * - intent wire 由 Rust `graph_intent.rs` 冻结（serde）：devices[].pipeline
 *   = { source, sink } 为必填——缺 pipeline 会被 agent 以
 *   `invalid_intent: missing field "pipeline"` 拒绝（真机 BMD 实证，
 *   2026-09-29；此前 StubPlane 集成测试掩盖了该缺口）；
 * - Web Console 不发明 schema：source.kind 固定词表 {decklink, rtmp,
 *   self_test}；本 builder 只构造 decklink 采集会话（operator console 的
 *   首个真实旅程，与 RCE-01B / CP-01E 真机旅程同形态）；
 * - sink 采用 `appsink`（纯采集，无外部推流依赖；不涉及输出设备）。
 */
import type { StartSessionBody } from "./schemas.ts";

export interface DecklinkCaptureIntent {
  version: "1.0";
  devices: [
    {
      device_id: string;
      role: "CAPTURE";
      pipeline: {
        source: { kind: "decklink"; device_id: string; port_id?: string };
        sink: { kind: "appsink" };
      };
    },
  ];
}

/** 单输入 DeckLink 采集会话的 canonical intent。device_id 必须是 canonical UUID。 */
export function buildDecklinkCaptureIntent(deviceId: string): DecklinkCaptureIntent {
  return {
    version: "1.0",
    devices: [
      {
        device_id: deviceId,
        role: "CAPTURE",
        pipeline: {
          source: { kind: "decklink", device_id: deviceId },
          sink: { kind: "appsink" },
        },
      },
    ],
  };
}

/** StartSessionBody 兼容性：intent 结构必须能作为 POST /api/v1/sessions body。 */
export type StartIntentBody = StartSessionBody;
