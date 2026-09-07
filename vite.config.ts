import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    // Cloudflare plugin must come BEFORE React — it sets up the workerd runtime
    cloudflare(),
    react(),
  ],
  build: {
    // Output the client SPA assets to dist/client (referenced in wrangler.jsonc)
    outDir: "dist/client",
    sourcemap: false,
  },
});
