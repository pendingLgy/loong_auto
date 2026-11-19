import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

/**
 * Web 端开发期由 Vite 提供服务，`/api` 代理到本地网关，避免浏览器跨域；
 * 生产构建产物由本地网关托管，前端不直接访问云端。
 */
export default defineConfig({
  plugins: [solid(), tailwindcss()],
  // 兜底：即使某个文件没有经过 solid 插件，esbuild 也使用 Solid 的自动 JSX 运行时，
  // 避免退化成 `React.createElement` 并报 "React is not defined"。
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "solid-js",
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
    // @loong/ui 以源码形式提供，交给 vite-plugin-solid 转换，不做预打包。
    exclude: ["@loong/ui"],
  },
  resolve: {
    // 工作区内只保留一份 solid-js，避免 HMR/响应式因重复实例失效。
    dedupe: ["solid-js"],
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
