/**
 * ⚠️ INTERNAL TABLE - DO NOT IMPORT DIRECTLY
 *
 * This table requires orgId for ALL queries (multi-tenant).
 * Use functions from queries/mini-apps-history/ instead.
 *
 * @internal
 */
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { nanoid } from "@zdocs/util";
import { organizationsTbl } from "./organizations";
import { miniAppsTbl } from "./mini-apps";
import type { MiniAppHistory } from "@zdocs/types";

export const miniAppsHistoryTbl = pgTable(
  "mini_apps_history",
  {
    id: varchar("id", { length: 191 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    miniAppId: varchar("mini_app_id", { length: 191 })
      .notNull()
      .references(() => miniAppsTbl.id, { onDelete: "cascade" }),
    orgId: varchar("org_id", { length: 191 })
      .notNull()
      .references(() => organizationsTbl.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 }).notNull(),

    // Snapshot of app data at save time
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    color: varchar("color", { length: 7 }), // Hex color code (e.g., #6366f1)
    icon: varchar("icon", { length: 100 }), // Lucide icon name (e.g., "Settings", "Home")
    code: text("code").notNull(),
    isPublished: boolean("is_published").notNull().default(false),

    // Timestamp
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    miniAppIdIdx: index("mini_apps_history_mini_app_id_idx").on(
      table.miniAppId
    ),
    orgIdx: index("mini_apps_history_org_idx").on(table.orgId),
    createdAtIdx: index("mini_apps_history_created_at_idx").on(table.createdAt),
    orgMiniAppIdx: index("mini_apps_history_org_mini_app_idx").on(
      table.orgId,
      table.miniAppId
    ),
  })
);

// Type compatibility check (will error at build time if incompatible)
const _typeCheck: MiniAppHistory = {} as typeof miniAppsHistoryTbl.$inferSelect;
