/**
 * Operator credential bootstrap (WCE-01B · §5)。
 *
 * - 浏览器仅承担"输入并显式持有"角色；不在 URL/log/telemetry 出现；
 * - 仅在运行时内存（closure-scoped variable）；reload = 清空，UI 必须显式回到
 *   credential-required 状态；
 * - 任何对 localStorage / sessionStorage / cookie / document.cookie 的写入都
 *   违反本约束；测试断言此红线。唯一豁免 = UI_STORAGE_KEYS（见下）。
 */
import { I18N_STORAGE_KEY } from "../i18n/index.ts";

// WCO-01A：i18n 只持久化一个非凭据 UI 键（vbmf.locale）；api key 落 storage 仍必炸。
const UI_STORAGE_KEYS = new Set<string>([I18N_STORAGE_KEY]);

let current: string | null = null;

export function getApiKey(): string | null {
  return current;
}

export function setApiKey(key: string): void {
  // trim 但不验证——validation 由 Fastify /api/v1/* 的 security 链负责
  const trimmed = key.trim();
  current = trimmed.length > 0 ? trimmed : null;
}

export function clearApiKey(): void {
  current = null;
}

export function hasApiKey(): boolean {
  return current !== null && current.length > 0;
}

// 自检：开发期防止误用持久化路径。运行时单测调用 `assertNoPersistentStorage()`。
//
// 检查维度：
// 1) globalThis 上没有 localStorage / sessionStorage 引用（生产路径应如此）；
// 2) 即使 storage 存在（jsdom 测试环境会暴露），API key 也未写入任何 entry。
export function assertNoPersistentStorage(): void {
  type Slot = { length?: number; key?: (i: number) => string | null; getItem?: (k: string) => string | null };
  const env = globalThis as {
    localStorage?: Slot;
    sessionStorage?: Slot;
    window?: { localStorage?: Slot; sessionStorage?: Slot };
  };
  // 1) 检查 window 的 storage（浏览器 window===globalThis；jsdom 下裸标识符被
  //    Node ≥25 的实验性 getter 遮蔽，window.localStorage 才是真 storage）。
  //    本断言允许测试环境提供 storage，但除白名单外必须为空。
  const g = env.window ?? env;
  for (const slot of [g.localStorage, g.sessionStorage]) {
    if (slot === undefined) continue;
    const len = typeof slot.length === "number" ? slot.length : 0;
    for (let i = 0; i < len; i += 1) {
      const k = slot.key?.(i);
      if (k !== undefined && k !== null && !UI_STORAGE_KEYS.has(k)) {
        throw new Error(
          "WEB-CONSOLE-ENTRY-01 red line: localStorage/sessionStorage contains non-allowlisted entries (api key MUST NOT be persisted)",
        );
      }
    }
  }
  // 2) 模块级 current = null（保证 reload 后清空——见 auth.credentials.test.ts）。
  if (current !== null) {
    throw new Error(
      "WEB-CONSOLE-ENTRY-01 red line: credentials module retained a value at assert time",
    );
  }
}
