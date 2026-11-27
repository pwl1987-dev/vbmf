/**
 * WCO-01B 监看窗（D2：hls.js 为前端唯一新依赖）。播同源 /hls/index.m3u8 ——
 * 语义 = 近实时 HLS（~6–10s 延迟）；广播级监看仍由 Mini Monitor 承担。
 * E-42 预览流未实现：数据源 = HLS 会话产物，E-42 落地时只换 src。
 * Safari 原生 HLS 对该流实测黑屏（2026-11-27 BMD）→ 不做 native 兜底。
 */
import type * as React from "react";
import { useEffect, useRef } from "react";
import HlsModule from "hls.js";

export const HLS_PLAYLIST_PATH = "/hls/index.m3u8";

// NodeNext 把 hls.js 的 CJS 形态 d.ts 的 `export default` 解析成命名空间包裹；
// vite/vitest 运行时打包的是 hls.mjs（default 导出 = Hls 类本体，见 dist/hls.mjs 尾部）。
// shortcut: 只声明本组件用到的 API 面, 升级 hls.js 时在此收口。
interface HlsLike {
  loadSource(url: string): void;
  attachMedia(el: HTMLVideoElement): void;
  destroy(): void;
}
type HlsCtor = { isSupported(): boolean; new (cfg?: { liveDurationInfinity?: boolean }): HlsLike };
const Hls = HlsModule as unknown as HlsCtor;

export function HlsMonitor({ playing }: { playing: boolean }): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (!playing) return;
    const video = videoRef.current;
    if (video === null || !Hls.isSupported()) return;
    const hls = new Hls({ liveDurationInfinity: true });
    hls.loadSource(HLS_PLAYLIST_PATH);
    hls.attachMedia(video);
    return () => hls.destroy();
  }, [playing]);
  return playing ? (
    <video ref={videoRef} className="dash-player" controls autoPlay muted playsInline />
  ) : (
    <div className="dash-player dash-player-idle">▢</div>
  );
}
