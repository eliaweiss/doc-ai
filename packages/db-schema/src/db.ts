/**
 * doc-ai: embedded PGlite database (replaces zdocs' Neon / postgres-js connection).
 *
 * One PGlite instance per process, stored in `<data dir>/pgdata` (see data-dir.ts).
 * The rest of the zdocs query layer uses `zdocsDb` unchanged.
 */
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { vector } from "@electric-sql/pglite/vector";
import { drizzle } from "drizzle-orm/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import path from "path";
import fs from "fs";
import { getDataDir } from "./data-dir";

function createClient(): PGlite {
  if (process.env.DOC_AI_DB_IN_MEMORY === "1") {
    return new PGlite({ extensions: { pg_trgm, vector } });
  }
  const pgdata = path.join(getDataDir(), "pgdata");
  fs.mkdirSync(pgdata, { recursive: true });
  return new PGlite(pgdata, { extensions: { pg_trgm, vector } });
}

export const pgliteClient = createClient();

// Typed as the generic pg database so the zdocs queries keep their types.
type ZdocsDb = PgDatabase<PgQueryResultHKT, Record<string, never>>;
export const zdocsDb = drizzle(pgliteClient) as unknown as ZdocsDb;

export type TransactionClient =
  Parameters<Parameters<typeof zdocsDb.transaction>[0]>[0];

export async function runTransaction<T>(
  fn: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  return zdocsDb.transaction(fn);
}

export async function closeDatabase(): Promise<void> {
  await pgliteClient.close();
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
