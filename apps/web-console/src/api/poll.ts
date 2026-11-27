/**
 * 轮询守卫（CP-01C 限流 · 多设备同时看 · §3.125）。
 *
 * 背景：所有 console 标签页共用同一枚 operator key ⇒ 同一 principal ⇒ 共用服务端读桶
 * （RATE_LIMIT_READ_MAX = 240 次 / 60 秒）。原 2s 节奏下每台设备 60 次/分 ⇒
 * 4 台同看就打满（实测复现：429 × 10，红色横幅刷屏）。
 *
 * 两条守卫：
 * - 页面不可见（切后台 / 同浏览器其它标签页）→ 不发请求；
 * - 处于服务端 429 冷却期（rateLimitCooldownMs > 0）→ 不发请求。
 */
import { rateLimitCooldownMs } from "./rateLimit.ts";

/** 轮询节奏 5s ⇒ 每台 24 次/分（runtime+alarms）⇒ 240/分 读桶可容约 10 台同时可见。 */
export const POLL_INTERVAL_MS = 5000;

export function shouldSkipPoll(): boolean {
  return document.hidden || rateLimitCooldownMs() > 0;
}
