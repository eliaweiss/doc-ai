import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const shim = (f: string) => path.resolve(__dirname, "src/shims", f);
const packagesDir = path.resolve(__dirname, "../../packages");
const serverUrl = process.env.DOC_AI_SERVER_URL || "http://127.0.0.1:4310";

// NEXT_PUBLIC_* values the copied zdocs client/util read at build time
const publicEnv = {
  NEXT_PUBLIC_APP_NAME: "doc-ai",
  NEXT_PUBLIC_URL: "",
  NEXT_PUBLIC_DOCS_URL: "",
  NEXT_PUBLIC_MAIN_URL: "",
  NEXT_PUBLIC_ENABLE_DATASET: "false",
  NEXT_PUBLIC_ENABLE_BANK_LINKS: "false",
  NEXT_PUBLIC_ENABLE_QB_INTEGRATION: "false",
  NEXT_PUBLIC_ENABLE_XERO_INTEGRATION: "false",
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // zdocs client is written for Next.js; these keep its files unchanged
      { find: /^next\/navigation$/, replacement: shim("next-navigation.ts") },
      { find: /^next\/link$/, replacement: shim("next-link.tsx") },
      { find: /^next\/image$/, replacement: shim("next-image.tsx") },
      { find: /^next-auth\/react$/, replacement: shim("next-auth-react.tsx") },
      { find: /^next-auth$/, replacement: shim("next-auth.ts") },
      { find: /^next-intl$/, replacement: shim("next-intl.tsx") },
      // Deep imports of single pages (the @zdocs/client barrel pulls in every zdocs feature)
      { find: /^@zdocs\/client\/src\//, replacement: packagesDir + "/client/src/" },
      // zdocs tsconfig baseUrl import style: "packages/client/src/..."
      { find: /^packages\//, replacement: packagesDir + "/" },
    ],
  },
  define: {
    "process.env": JSON.stringify({ NODE_ENV: process.env.NODE_ENV ?? "development", ...publicEnv }),
  },
  server: {
    port: 4311,
    proxy: { "/api": serverUrl, "/mcp": serverUrl },
  },
  build: { outDir: "dist", sourcemap: true, chunkSizeWarningLimit: 4000 },
});
