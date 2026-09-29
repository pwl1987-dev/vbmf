/**
 * Credential bootstrap tests (WCE-01B · §5)。
 * - 不持久化到 localStorage / sessionStorage；
 * - 不写 URL / log / telemetry；
 * - reload = 清空（模块级变量重置）。
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  assertNoPersistentStorage,
  clearApiKey,
  getApiKey,
  hasApiKey,
  setApiKey,
} from "../src/auth/credentials.ts";

describe("credentials module", () => {
  beforeEach(() => {
    clearApiKey();
  });

  it("starts empty", () => {
    expect(getApiKey()).toBeNull();
    expect(hasApiKey()).toBe(false);
  });

  it("setApiKey stores trimmed value", () => {
    setApiKey("  vbmf_test_key  ");
    expect(getApiKey()).toBe("vbmf_test_key");
  });

  it("setApiKey('') clears", () => {
    setApiKey("vbmf_test_key");
    setApiKey("");
    expect(getApiKey()).toBeNull();
  });

  it("clearApiKey wipes", () => {
    setApiKey("vbmf_test_key");
    clearApiKey();
    expect(getApiKey()).toBeNull();
    expect(hasApiKey()).toBe(false);
  });

  it("assertNoPersistentStorage passes in clean jsdom", () => {
    expect(() => assertNoPersistentStorage()).not.toThrow();
  });
});
