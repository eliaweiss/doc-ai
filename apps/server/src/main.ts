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
import { mountUiTxFolderRoutes } from "./folders/ui-tx-routes";

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
  // MCP folder tools and uiTx folder methods go through the app's own routes,
  // so directory sync applies to them too
  const api = async (route: string, body: unknown) => {
    const res = await app.request(route, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json: any = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error ?? `${route} failed (${res.status})`);
    return json;
  };
  app.route("/api/local", createApi({ onEnqueued, onWatchDirChanged: restartWatcher }));
  mountLocalRoutes(app, { onEnqueued });
  // Before the zdocs routes: wraps their folder/document handlers with directory sync
  mountFolderSyncRoutes(app);
  // Before the zdocs /api/ui-tx route: answers listFolders and moveDocuments
  mountUiTxFolderRoutes(app, api);
  const mounted = await mountZdocsRoutes(app);
  console.log(`[doc-ai] Mounted ${mounted.length} zdocs API handlers`);
  // zdocs features that don't exist locally (billing, mini-apps, integrations, ...)
  app.all("/api/*", (c) => c.json({ error: `Not available in doc-ai: ${c.req.path}` }, 404));
  app.all("/mcp", (c) => handleMcpRequest(c.req.raw, { onEnqueued, api }));

  const webRoot = path.relative(process.cwd(), webDist);
  app.use("/*", serveStatic({ root: webRoot }));
  // Client-side routes (/folder, /document/:id, ...) fall back to the SPA
  app.get("*", serveStatic({ root: webRoot, path: "index.html" }));
  // No UI build at all: say so instead of a bare 404
  app.get("*", (c) =>
    c.html(
      `<!doctype html><meta charset="utf-8"><title>doc-ai</title>` +
        `<body style="font-family:system-ui;padding:2rem"><h1>doc-ai UI is not built</h1>` +
        `<p>Run <code>npm run build</code> in the doc-ai folder, then reload. ` +
        `The API (<code>/api</code>) and MCP (<code>/mcp</code>) are running.</p></body>`,
      503
    )
  );

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
