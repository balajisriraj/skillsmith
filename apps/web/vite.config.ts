import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": { target: process.env.SKILLSMITH_API ?? "http://localhost:8000", changeOrigin: true } } },
});
