/**
 * dev-only credential-gate bypass（测试版免密钥）。
 *
 * 信任边界（勿放宽）：
 * - `import.meta.env.DEV` 在 vite 生产构建里被静态替换为 false ⇒ 生产包永远进不了
 *   免密分支，即使构建机上带着 VITE_DEV_NO_AUTH=1；
 * - 还需显式 opt-in：只有 dev server 进程环境里的 VITE_DEV_NO_AUTH=1 才开启；
 * - 前提是 dev proxy 已在服务端注入 operator 凭据（见 vite.config.ts），浏览器不持凭据。
 */
export function isDevNoAuth(
  env: Record<string, unknown> = import.meta.env as unknown as Record<string, unknown>,
): boolean {
  return env.DEV === true && env.VITE_DEV_NO_AUTH === "1";
}
