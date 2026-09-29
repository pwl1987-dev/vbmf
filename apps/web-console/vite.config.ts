/**
 * Vite config for VBMF Web Console (WEB-CONSOLE-ENTRY-01 / WCE-01B).
 *
 * - `server.port = 5173` 匹配 frozen Deployment SoT §4 + nginx upstream `web`。
 * - 不配 proxy：浏览器只走 same-origin `/api/*` `/events/*` `/health/*`，由
 *   Nginx 反代到 fastify（生产路径）；dev 容器内如要直连 fastify，由运维
 *   `host.docker.internal` 或 dev compose 单独处理——本 app 不替运维做假设。
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: "0.0.0.0",
    strictPort: true,
  },
  preview: {
    port: 5173,
    host: "0.0.0.0",
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    globals: false,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
