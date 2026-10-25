import { sql } from "drizzle-orm";
import { pgTable, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { type ProcessLock } from "@zdocs/types";

/**
 * Process Lock table - prevents concurrent daemon execution
 *
 * Used to ensure only one instance of a daemon runs at a time,
 * even across multiple serverless function invocations.
 */
export const processLockTbl = pgTable("process_locks", {
  id: integer("id").primaryKey(), // Fixed IDs from PROCESS_LOCK_IDS
  lockFlag: boolean("lock_flag").notNull().default(false),
  lastAcquired: timestamp("last_acquired", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .default(sql`now()`),
});

// Type compatibility check (will error at build time if incompatible)
const _typeCheck: ProcessLock = {} as typeof processLockTbl.$inferSelect;

