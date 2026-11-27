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

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: "0.0.0.0",
    strictPort: true,
    // dev-only：本 Mac 上看新 console 时直连远端后端；生产仍是 Nginx 同源反代，红线不变。
    proxy: {
      "/api": { target: devTarget, changeOrigin: true },
      "/events": { target: devTarget, changeOrigin: true },
      "/health": { target: devTarget, changeOrigin: true },
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
