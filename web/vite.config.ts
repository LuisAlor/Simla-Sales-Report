import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  // Serve repo-root assets/ as the static public dir so assets/logo.png → /logo.png
  publicDir: path.resolve(__dirname, "../assets"),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api/v5": {
        target: "https://base.simla.com",
        changeOrigin: true,
        secure: true,
      },
      "/tldv-api": { target: "https://pasta.tldv.io", changeOrigin: true, secure: true, rewrite: (path) => path.replace(/^\/tldv-api/, "") },
      "/anthropic-api": { target: "https://api.anthropic.com", changeOrigin: true, secure: true, rewrite: (path) => path.replace(/^\/anthropic-api/, "") },
    },
  },
});
