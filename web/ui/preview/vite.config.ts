import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";

export default defineConfig({
  root: "preview",
  plugins: [solid(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    // Windows 下通过轮询监听预览入口与 ../src 的组件源码。
    watch: {
      usePolling: true,
      interval: 300,
    },
    hmr: {
      overlay: true,
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  resolve: {
    dedupe: ["solid-js", "@solidjs/web"],
  },
});
