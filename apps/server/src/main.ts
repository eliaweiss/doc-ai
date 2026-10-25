/**
 * doc-ai service: one long-running process that owns the PGlite DB and runs
 * the folder watcher, the queue worker, the HTTP API + UI and the MCP server.
 */
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { closeDatabase } from "@zdocs/db-schema";
import { getConfig } from "@zdocs/srv";
import { initDatabase } from "./db";
import { startWatcher } from "./watcher";
import { startWorker } from "./worker";
import { createApi } from "./api";
import { handleMcpRequest } from "./mcp";
import { mountZdocsRoutes } from "./next-compat/mount-routes";
import { mountLocalRoutes } from "./local-routes";
import { mountFolderSyncRoutes } from "./folder-routes";

// zdocs client, built by `npm run build -w @doc-ai/web`
const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist");

async function main() {
  const config = getConfig();
  await fs.mkdir(config.dataDir, { recursive: true });

  await initDatabase();
  console.log(`[doc-ai] Database ready at ${config.dataDir}`);

  if (config.provider === "gateway" && !config.gatewayApiKey) {
    console.warn("[doc-ai] AI_GATEWAY_API_KEY is not set: documents will wait with KEY_ERROR until it is.");
  }

  const worker = startWorker();
  const onEnqueued = () => worker.kick();

  // The watch folder can be changed from the Settings page, so the watcher restarts
  let watcher: ReturnType<typeof startWatcher> | null = null;
  const restartWatcher = async () => {
    await watcher?.close();
    const { watchDir } = getConfig();
    watcher = watchDir ? startWatcher({ watchDir, onEnqueued }) : null;
    if (!watcher) console.warn("[doc-ai] No watch folder set: folder watching is off.");
  };
  await restartWatcher();

  const app = new Hono();
  app.route("/api/local", createApi({ onEnqueued, onWatchDirChanged: restartWatcher }));
  mountLocalRoutes(app, { onEnqueued });
  // Before the zdocs routes: wraps their folder/document handlers with directory sync
  mountFolderSyncRoutes(app);
  const mounted = await mountZdocsRoutes(app);
  console.log(`[doc-ai] Mounted ${mounted.length} zdocs API handlers`);
  // zdocs features that don't exist locally (billing, mini-apps, integrations, ...)
  app.all("/api/*", (c) => c.json({ error: `Not available in doc-ai: ${c.req.path}` }, 404));
  app.all("/mcp", (c) => handleMcpRequest(c.req.raw, { onEnqueued }));

  const webRoot = path.relative(process.cwd(), webDist);
  app.use("/*", serveStatic({ root: webRoot }));
  // Client-side routes (/folder, /document/:id, ...) fall back to the SPA
  app.get("*", serveStatic({ root: webRoot, path: "index.html" }));

  const server = serve({ fetch: app.fetch, port: config.port, hostname: "127.0.0.1" }, (info) => {
    console.log(`[doc-ai] UI   http://localhost:${info.port}`);
    console.log(`[doc-ai] MCP  http://localhost:${info.port}/mcp`);
  });

  const shutdown = async () => {
    console.log("[doc-ai] Shutting down");
    worker.stop();
    await watcher?.close();
    server.close();
    await closeDatabase();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("[doc-ai] Fatal:", error);
  process.exit(1);
});
