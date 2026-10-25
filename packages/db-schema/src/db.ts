/**
 * doc-ai: embedded PGlite database (replaces zdocs' Neon / postgres-js connection).
 *
 * One PGlite instance at a time, stored in `<workspace>/pgdata` (see
 * data-dir.ts): each watch folder has its own. `openDatabase` opens it and
 * switches when the watch folder changes; `pgliteClient` and `zdocsDb` always
 * point at the open one, so the rest of the zdocs query layer is unchanged.
 */
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { vector } from "@electric-sql/pglite/vector";
import { drizzle } from "drizzle-orm/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import path from "path";
import fs from "fs";

// Typed as the generic pg database so the zdocs queries keep their types.
type ZdocsDb = PgDatabase<PgQueryResultHKT, Record<string, never>>;

let current: { client: PGlite; db: ZdocsDb; dir: string | null } | null = null;

function requireCurrent() {
  if (!current) throw new Error("Database is not open (call initDatabase first)");
  return current;
}

/** Forwards to whatever the open instance is, with methods bound to it */
function forward<T extends object>(get: () => T): T {
  return new Proxy({} as T, {
    get(_, prop) {
      const target = get();
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
    // So `pgliteClient instanceof PGlite` holds (drizzle checks it)
    getPrototypeOf: () => Object.getPrototypeOf(get()),
  });
}

export const pgliteClient: PGlite = forward(() => requireCurrent().client);
export const zdocsDb: ZdocsDb = forward(() => requireCurrent().db);

/** Open the database in `<workspaceDir>/pgdata`, closing the one open before. */
export async function openDatabase(workspaceDir: string): Promise<void> {
  await closeDatabase();
  let client: PGlite;
  if (process.env.DOC_AI_DB_IN_MEMORY === "1") {
    client = new PGlite({ extensions: { pg_trgm, vector } });
  } else {
    const pgdata = path.join(workspaceDir, "pgdata");
    fs.mkdirSync(pgdata, { recursive: true });
    client = new PGlite(pgdata, { extensions: { pg_trgm, vector } });
  }
  current = { client, db: drizzle(client) as unknown as ZdocsDb, dir: workspaceDir };
}

/** Workspace folder of the open database */
export function getOpenWorkspaceDir(): string | null {
  return current?.dir ?? null;
}

export type TransactionClient =
  Parameters<Parameters<typeof zdocsDb.transaction>[0]>[0];

export async function runTransaction<T>(
  fn: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  return zdocsDb.transaction(fn);
}

export async function closeDatabase(): Promise<void> {
  const open = current;
  current = null;
  await open?.client.close();
}

export function extractRows<T = Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }

  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }

  return [];
}

export function extractRowCount(result: unknown): number {
  if (result && typeof result === "object" && "affectedRows" in result) {
    return (result as { affectedRows?: number }).affectedRows ?? 0;
  }

  if (result && typeof result === "object" && "rowCount" in result) {
    return (result as { rowCount?: number }).rowCount ?? 0;
  }

  if (Array.isArray(result)) {
    return result.length;
  }

  return 0;
}
