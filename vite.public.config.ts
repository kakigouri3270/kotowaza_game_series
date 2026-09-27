import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Build the client assets. Wrangler separately bundles worker/index.ts for
// the cumulative leaderboard; archived Sites APIs remain source-only.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  build: {
    outDir: "public-dist",
    sourcemap: false,
  },
});
