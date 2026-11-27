/**
 * CP-01C 应用层限流冷却（§3.125）。
 *
 * 服务端 429 带 `retry-after`（SDK 解析为 VbmfApiError.retryAfterMs）。冷却期内不再发请求
 * —— 越限不越刷；到期自动恢复。状态在模块内共享 ⇒ 同一标签页的所有页面/轮询共用一份冷却。
 *
 * 独立成模块而非挂在 client.ts：页面测试会整体 mock client.ts，冷却状态若寄生其上，
 * 轮询守卫就会在测试里变成"未定义导出"。
 */
let cooldownUntil = 0;

export function noteRateLimited(retryAfterMs: number | null): void {
  const waitMs = retryAfterMs !== null && retryAfterMs > 0 ? retryAfterMs : 1000;
  cooldownUntil = Math.max(cooldownUntil, Date.now() + waitMs);
}

export function rateLimitCooldownMs(now: number = Date.now()): number {
  return Math.max(0, cooldownUntil - now);
}
