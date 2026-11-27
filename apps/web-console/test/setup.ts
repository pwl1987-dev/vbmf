/**
 * vitest setup：Node ≥25 在 globalThis 挂了实验性 localStorage getter（未给
 * --localstorage-file 时返回 undefined），vitest jsdom 环境又是
 * window===globalThis 的 populateGlobal 形态 → 裸/window/localStorage 全是
 * undefined，jsdom 自带的 Storage 被遮蔽。这里仅在缺失时补一个内存 storage，
 * 让 i18n 持久化与 credentials 红线断言在测试里真实执行。
 */
function makeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string): string | null => map.get(k) ?? null,
    setItem: (k: string, v: string): void => {
      map.set(k, String(v));
    },
    removeItem: (k: string): void => {
      map.delete(k);
    },
    clear: (): void => {
      map.clear();
    },
    key: (i: number): string | null => [...map.keys()][i] ?? null,
    get length(): number {
      return map.size;
    },
  };
}

const g = globalThis as { localStorage?: unknown; sessionStorage?: unknown };
for (const name of ["localStorage", "sessionStorage"] as const) {
  if (g[name] === undefined) {
    Object.defineProperty(globalThis, name, { value: makeStorage(), writable: true, configurable: true });
  }
}
