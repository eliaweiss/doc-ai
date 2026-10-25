/**
 * Mount zdocs' copied App Router route handlers (every route.ts under src/zdocs-api) on Hono.
 *
 * `org/[orgId]/documents/[documentId]/route.ts` → `/api/org/:orgId/documents/:documentId`,
 * each exported GET/POST/PUT/PATCH/DELETE called as `handler(req, { params })`
 * like Next.js 15 does (params is a Promise).
 */
import type { Hono } from "hono";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import { NextRequest } from "./server";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../zdocs-api");

async function findRoutes(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await findRoutes(full)));
    else if (entry.name === "route.ts") out.push(full);
  }
  return out;
}

function toHonoPath(file: string): string {
  const rel = path.relative(apiDir, path.dirname(file)).split(path.sep);
  return "/api/" + rel.map((s) => s.replace(/^\[(.+)\]$/, ":$1")).join("/");
}

/** Static segments before params, so /documents/status wins over /documents/:documentId */
function specificity(p: string): number[] {
  return p.split("/").map((s) => (s.startsWith(":") ? 0 : 1));
}

export async function mountZdocsRoutes(app: Hono): Promise<string[]> {
  const files = await findRoutes(apiDir);
  const routes = files
    .map((file) => ({ file, route: toHonoPath(file) }))
    .sort((a, b) => {
      const sa = specificity(a.route), sb = specificity(b.route);
      for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
        const d = (sb[i] ?? -1) - (sa[i] ?? -1);
        if (d !== 0) return d;
      }
      return 0;
    });

  const mounted: string[] = [];
  for (const { file, route } of routes) {
    const mod = await import(file);
    for (const method of METHODS) {
      const handler = mod[method];
      if (typeof handler !== "function") continue;
      app.on(method, route, async (c) => {
        const raw = c.req.raw;
        const req = new NextRequest(raw.url, {
          method: raw.method,
          headers: raw.headers,
          body: raw.method === "GET" || raw.method === "HEAD" ? undefined : await raw.arrayBuffer(),
        });
        return handler(req, { params: Promise.resolve(c.req.param()) });
      });
      mounted.push(`${method} ${route}`);
    }
  }
  return mounted;
}
