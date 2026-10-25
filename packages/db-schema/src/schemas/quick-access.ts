/**
 * ⚠️ INTERNAL TABLE - DO NOT IMPORT DIRECTLY
 *
 * This table requires orgId for ALL queries (multi-tenant).
 * Use functions from queries/quick-access/ instead.
 *
 * @internal
 */
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { nanoid } from "@zdocs/util";
import { organizationsTbl } from "./organizations";
import { usersTbl } from "./auth";
import type { QuickAccessItem } from "@zdocs/types";

export const quickAccessTbl = pgTable(
  "quick_access",
  {
    id: varchar("id", { length: 191 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    orgId: varchar("org_id", { length: 191 })
      .notNull()
      .references(() => organizationsTbl.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 191 })
      .notNull()
      .references(() => usersTbl.id, { onDelete: "cascade" }),

    // App reference - either system app name or mini app id
    appId: varchar("app_id", { length: 191 }).notNull(), // System app name (e.g., "browse", "search") or mini app id
    appType: text("app_type", { enum: ["system", "mini_app"] }).notNull(), // Type of app

    // Display order
    displayOrder: integer("display_order").notNull().default(0),

    // Timestamps
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    // Unique constraint: one user can't pin the same app twice
    orgUserAppUniqueIdx: uniqueIndex("quick_access_org_user_app_idx").on(
      table.orgId,
      table.userId,
      table.appId,
      table.appType
    ),
    // Index for listing user's quick access items
    orgUserIdx: index("quick_access_org_user_idx").on(
      table.orgId,
      table.userId
    ),
  })
);

// Type compatibility check (will error at build time if incompatible)
const _typeCheck: QuickAccessItem =
  {} as typeof quickAccessTbl.$inferSelect;
