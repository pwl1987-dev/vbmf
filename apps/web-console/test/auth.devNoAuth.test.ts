/**
 * dev-only 免密开关的边界测试。
 * 关键不变量：生产构建（import.meta.env.DEV=false）永远进不了免密分支。
 */
import { describe, expect, it } from "vitest";
import { isDevNoAuth } from "../src/auth/devNoAuth.ts";

describe("dev-only credential gate bypass", () => {
  it("opens only with the explicit dev opt-in", () => {
    expect(isDevNoAuth({ DEV: true, VITE_DEV_NO_AUTH: "1" })).toBe(true);
  });

  it("can never open in a production build", () => {
    expect(isDevNoAuth({ DEV: false, VITE_DEV_NO_AUTH: "1" })).toBe(false);
  });

  it("stays closed without the opt-in", () => {
    expect(isDevNoAuth({ DEV: true })).toBe(false);
    expect(isDevNoAuth({})).toBe(false);
  });
});
