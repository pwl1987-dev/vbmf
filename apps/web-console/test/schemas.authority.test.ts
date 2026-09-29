/**
 * Schema authority guard (WCE-01A · §3)。
 * 强制 Web Console 不得发明 parallel schema：仅从 `apps/api/src/routes/schemas.ts`
 * 导入类型常量。任何 drift → 测试失败。
 */
import { describe, expect, it } from "vitest";
import {
  ERROR_CODE_VALUES,
  commandStateSchema,
  errorEnvelopeSchema,
  healthLayersSchema,
  healthLiveSchema,
  productSessionSchema,
  runtimeSnapshotSchema,
  sseFramePayloadSchema,
  startSessionBodySchema,
} from "../src/api/schemas.ts";

describe("schema authority", () => {
  it("exports the 12-code ErrorCode vocabulary", () => {
    expect(ERROR_CODE_VALUES).toEqual([
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
    ]);
  });

  it("errorEnvelopeSchema requires code+message+request_id+retryable", () => {
    expect(errorEnvelopeSchema.required).toEqual(["error"]);
    const errProps = (errorEnvelopeSchema.properties as { error: { required: string[] } }).error.required;
    expect(errProps.sort()).toEqual(["code", "message", "request_id", "retryable"].sort());
  });

  it("runtimeSnapshotSchema requires freshness envelope", () => {
    expect((runtimeSnapshotSchema.required as string[]).sort()).toEqual(
      [
        "capabilities",
        "devices",
        "generated_at_ms",
        "observation_lineage",
        "observation_revision",
        "ports",
        "program_switch",
        "resources",
        "sessions",
      ].sort(),
    );
  });

  it("productSessionSchema requires canonical id and wire label", () => {
    const props = productSessionSchema.properties as Record<string, { pattern?: string }>;
    expect(productSessionSchema.required).toEqual(["id", "label", "state", "phase", "outputs", "inputs"]);
    expect(props.id?.pattern).toBe("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$");
    expect(props.label?.pattern).toBe("^session-[0-9a-f]{32}$");
  });

  it("commandStateSchema enumerates the 6 terminal states", () => {
    expect(commandStateSchema.enum).toEqual([
      "pending",
      "completed",
      "failed",
      "timeout",
      "conflict",
      "rejected",
    ]);
  });

  it("startSessionBodySchema requires intent.version + intent.devices non-empty", () => {
    expect(startSessionBodySchema.required).toEqual(["intent"]);
    const intentProps = (startSessionBodySchema.properties as { intent: { required: string[]; properties: { devices: { minItems: number } } } }).intent;
    expect(intentProps.required.sort()).toEqual(["devices", "version"].sort());
    expect(intentProps.properties.devices.minItems).toBe(1);
  });

  it("healthLiveSchema returns status=live only", () => {
    expect((healthLiveSchema.properties as { status: { enum: string[] } }).status.enum).toEqual(["live"]);
  });

  it("healthLayersSchema contains all five layers", () => {
    const layersProps = (healthLayersSchema.properties as { layers: { required: string[] } }).layers;
    expect(layersProps.required.sort()).toEqual(["api", "auth", "db", "events", "runtime"].sort());
  });

  it("sseFramePayloadSchema enforces weak_ordering=true", () => {
    const payloadProps = sseFramePayloadSchema.properties as { weak_ordering: { const: boolean } };
    expect(payloadProps.weak_ordering.const).toBe(true);
  });
});
