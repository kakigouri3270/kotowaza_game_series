import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The public game is entirely client-side. No Sites auth, Worker code, or DB
// bindings are included in this build; the archived APIs remain source-only.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  build: {
    outDir: "public-dist",
    sourcemap: false,
  },
});
