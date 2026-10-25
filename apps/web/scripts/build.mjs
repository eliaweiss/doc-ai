/**
 * Build into dist.next, then swap it in. Vite empties its outDir first, so
 * building straight into dist left the running server without index.html
 * (404 on every page) for the length of the build.
 */
import { build } from "vite";
import { rm, rename } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const next = path.join(root, "dist.next");
const old = path.join(root, "dist.old");

await rm(next, { recursive: true, force: true });
await build({ root, build: { outDir: next, emptyOutDir: true } });

await rm(old, { recursive: true, force: true });
if (existsSync(dist)) await rename(dist, old);
await rename(next, dist);
await rm(old, { recursive: true, force: true });
console.log(`UI built: ${dist}`);
