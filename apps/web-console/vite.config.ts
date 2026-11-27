/**
 * Vite config for VBMF Web Console (WEB-CONSOLE-ENTRY-01 / WCE-01B).
 *
 * - `server.port = 5173` 匹配 frozen Deployment SoT §4 + nginx upstream `web`。
 * - 浏览器只走 same-origin `/api/*` `/events/*` `/health/*`，由 Nginx 反代到
 *   fastify（生产路径）。dev-only 的 `server.proxy` 仅把同源路径转给一台远端
 *   后端（默认 BMD nginx，可用 VBMF_DEV_PROXY 覆盖），不改前端取址方式。
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const devTarget = process.env.VBMF_DEV_PROXY ?? "http://10.30.15.10:8081";
// dev-only: with VBMF_DEV_API_KEY set, the dev proxy attaches the credential so the
// browser never holds it (nothing in URL / localStorage / logs). Test builds only —
// production keeps the Nginx same-origin route and the in-browser credential gate.
const devKey = process.env.VBMF_DEV_API_KEY;
const devProxy = devKey
  ? { target: devTarget, changeOrigin: true, headers: { "x-api-key": devKey } }
  : { target: devTarget, changeOrigin: true };

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: "0.0.0.0",
    strictPort: true,
    // dev-only：本 Mac 上看新 console 时直连远端后端；生产仍是 Nginx 同源反代，红线不变。
    proxy: {
      "/api": devProxy,
      "/events": devProxy,
      "/health": devProxy,
      // 监看窗播同源 /hls/index.m3u8：生产由 nginx location /hls/ 提供静态目录；
      // dev 代理漏放行时 vite 会把该路径回退成 SPA HTML ⇒ hls.js 解析失败 ⇒ 黑屏。
      // 不附带凭据：nginx /hls/ 是公开静态目录（无需 operator 凭据）。
      "/hls": { target: devTarget, changeOrigin: true },
    },
  },
  preview: {
    port: 5173,
    host: "0.0.0.0",
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    // WCO-01A：Node ≥25 实验性 localStorage getter 遮蔽 jsdom storage，见 test/setup.ts。
    setupFiles: ["test/setup.ts"],
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    globals: false,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
