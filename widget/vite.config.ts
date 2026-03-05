import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/widget.ts"),
      name: "P2FChatWidget",
      formats: ["iife"],
      fileName: () => "chat-widget.js",
    },
    outDir: path.resolve(__dirname, "../dist/widget"),
    emptyOutDir: true,
    minify: "esbuild",
  },
});
