import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/OAUTH-Repo/",   // 👈 ADD THIS LINE
  plugins: [react()],
  server: {
    proxy: {

      "/auth":           { target: "http://localhost:3000", changeOrigin: true },
      "/callback":       { target: "http://localhost:3000", changeOrigin: true },
      "/status.json":    { target: "http://localhost:3000", changeOrigin: true },
      "/status":         { target: "http://localhost:3000", changeOrigin: true },
      "/admin":          { target: "http://localhost:3000", changeOrigin: true },
      "/logout":         { target: "http://localhost:3000", changeOrigin: true },
      "/me":             { target: "http://localhost:3000", changeOrigin: true },
      "/profile":        { target: "http://localhost:3000", changeOrigin: true },
      "/events":         { target: "http://localhost:3000", changeOrigin: true }
    }
  }
});
