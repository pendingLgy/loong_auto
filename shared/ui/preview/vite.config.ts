import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

/**
 * 组件预览配置，不参与生产构建。
 * 通过 `bun run --filter '@loong/ui' preview` 启动，工作目录为 `shared/ui`。
 *
 * root 设为 `shared/ui`（而不是 `preview/`），让 `src/` 与 `preview/` 都在监听范围内，
 * 修改组件源码时 Vite 能直接推送 HMR 更新。
 */
export default defineConfig({
  root: ".",
  plugins: [solid({ include: [/\.tsx$/] }), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
  },
});
