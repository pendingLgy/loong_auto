import tailwindcss from "@tailwindcss/vite";
import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vite";

/**
 * Web 端开发期由 Vite 提供服务，`/api` 代理到本地网关；
 * 生产构建产物由本地网关托管，前端不直接访问云端。
 */
export default defineConfig({
  plugins: [solid(), tailwindcss()],
  define: {
    "process.env": "{}",
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:9528",
        changeOrigin: false,
      },
    },
  },
  optimizeDeps: {
    exclude: ["@loong/ui"],
  },
  resolve: {
    dedupe: ["solid-js", "@solidjs/web"],
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
