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
import { I18N_STORAGE_KEY } from "../src/i18n/index.ts";

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

  // WCO-01A：i18n 的 vbmf.locale 是白名单键；api key（任意其它键）落 storage 仍必炸。
  it("allowlists the i18n locale key; any other persisted entry still trips the red line", () => {
    const store = window.localStorage;
    store.setItem(I18N_STORAGE_KEY, "en-US");
    expect(() => assertNoPersistentStorage()).not.toThrow();
    store.setItem("accidental_persist", "vbmf_key");
    expect(() => assertNoPersistentStorage()).toThrow(/red line/);
    store.removeItem("accidental_persist");
    store.removeItem(I18N_STORAGE_KEY);
  });
});
