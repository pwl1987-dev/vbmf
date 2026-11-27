/**
 * WCO-01A — i18n 基础层单测（I18N_SPEC V0.1 的最小机械证明）。
 */
import { describe, expect, it, afterEach } from "vitest";
import { DICT } from "../src/i18n/dict.ts";
import { getLocale, I18N_STORAGE_KEY, setLocale, subscribeLocale, t } from "../src/i18n/index.ts";

afterEach(() => {
  setLocale("zh-CN");
});

describe("i18n foundation (WCO-01A)", () => {
  it("locale defaults to zh-CN (I18N_SPEC §1)", () => {
    expect(getLocale()).toBe("zh-CN");
  });

  it("chrome renders zh-CN by default", () => {
    expect(t("nav.health")).toBe("健康");
    expect(t("alarms.none")).toBe("无活动告警。");
  });

  it("switching to en-US changes site-wide text and persists to localStorage", () => {
    setLocale("en-US");
    expect(t("nav.health")).toBe("Health");
    expect(window.localStorage.getItem(I18N_STORAGE_KEY)).toBe("en-US");
  });

  it("unknown keys pass through verbatim (fail-soft)", () => {
    expect(t("nope.missing_key")).toBe("nope.missing_key");
  });

  it("subscribers are notified on switch until unsubscribed", () => {
    let hits = 0;
    const unsubscribe = subscribeLocale(() => {
      hits += 1;
    });
    setLocale("en-US");
    setLocale("zh-CN");
    unsubscribe();
    setLocale("en-US");
    expect(hits).toBe(2);
  });

  it("every dictionary row carries both zh-CN and en-US values (parity)", () => {
    for (const [key, row] of Object.entries(DICT)) {
      expect(row["zh-CN"].length, key).toBeGreaterThan(0);
      expect(row["en-US"].length, key).toBeGreaterThan(0);
    }
  });

  it("canonical vocabulary survives untranslated in zh-CN chrome (spec §2)", () => {
    const zhValues = Object.values(DICT).map((row) => row["zh-CN"]);
    for (const term of ["PostgreSQL", "Better Auth", "media-agent", "SSE", "Ack", "canonical"]) {
      expect(zhValues.some((v) => v.includes(term)), term).toBe(true);
    }
  });
});
