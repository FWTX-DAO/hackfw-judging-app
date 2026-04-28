import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const API_TARGET = process.env.API_TARGET || "http://localhost:3000";
const WS_TARGET = API_TARGET.replace(/^http/, "ws");

export default defineConfig({
  root: path.resolve(__dirname, "src/frontend"),
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
      "/ws":  { target: WS_TARGET, ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    sourcemap: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/frontend"),
    },
  },
});
