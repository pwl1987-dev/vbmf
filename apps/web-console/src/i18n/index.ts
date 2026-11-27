/**
 * i18n 基础层（WCO-01A · docs/phase-0.5/I18N_SPEC.md V0.1）。
 * - 仅 zh-CN（默认）/ en-US（fallback）两个 locale；
 * - canonical 词表不翻译：wire 字段值（RUNNING/LOCKED/HLS/…）直接渲染 API 数据，
 *   不经过 t()；t() 只承载 chrome 文案。
 * - localStorage 只存 `vbmf.locale`（非凭据键）：credentials 红线的运行时豁免见
 *   auth/credentials.ts，词法豁免见 scripts/check_web_console_red_lines.py。
 */
import { DICT } from "./dict.ts";

export type Locale = "zh-CN" | "en-US";

export const I18N_STORAGE_KEY = "vbmf.locale";

// shortcut: 显式 window.localStorage——Node ≥25 的全局实验性 localStorage getter 返回 undefined、
// 会在测试里遮蔽 jsdom 的 storage；浏览器里 window===globalThis，行为不变。
function storedLocale(): Locale {
  try {
    return window.localStorage.getItem(I18N_STORAGE_KEY) === "en-US" ? "en-US" : "zh-CN";
  } catch {
    return "zh-CN";
  }
}

let current: Locale = storedLocale();
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  current = locale;
  try {
    window.localStorage.setItem(I18N_STORAGE_KEY, locale);
  } catch {
    // 持久化失败只影响下次启动；本会话语言不受影响。
  }
  for (const fn of listeners) fn();
}

export function subscribeLocale(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** fallback_chain（I18N_SPEC §1）：当前 locale → zh-CN → en-US → key 原文。 */
export function t(key: string): string {
  const row = DICT[key];
  if (row === undefined) return key;
  return row[current] ?? row["zh-CN"] ?? row["en-US"] ?? key;
}
