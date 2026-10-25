/**
 * ⚠️ INTERNAL TABLE - DO NOT IMPORT DIRECTLY
 *
 * This table requires orgId for ALL queries (multi-tenant).
 * Use functions from queries/mini-apps/ instead.
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
  jsonb,
} from "drizzle-orm/pg-core";
import { nanoid } from "@zdocs/util";
import { organizationsTbl } from "./organizations";
import type { MiniApp } from "@zdocs/types";
import { UIMessage } from "ai";

export const miniAppsTbl = pgTable(
  "mini_apps",
  {
    id: varchar("id", { length: 191 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    orgId: varchar("org_id", { length: 191 })
      .notNull()
      .references(() => organizationsTbl.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 }).notNull(),

    // App metadata
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    color: varchar("color", { length: 7 }), // Hex color code (e.g., #6366f1)
    icon: varchar("icon", { length: 100 }), // Lucide icon name (e.g., "Settings", "Home")
    code: text("code").notNull(),

    // Publishing status
    isPublished: boolean("is_published").notNull().default(false),

    // Messages stored as JSONB (array of UIMessage)
    messages: jsonb("messages").$type<UIMessage[]>().notNull().default([]),

    // Timestamps
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    orgIdx: index("mini_apps_org_idx").on(table.orgId),
    orgUserIdx: index("mini_apps_org_user_idx").on(table.orgId, table.userId),
  })
);

// Type compatibility check (will error at build time if incompatible)
const _typeCheck: MiniApp = {} as typeof miniAppsTbl.$inferSelect;
