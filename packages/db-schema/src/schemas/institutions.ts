import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  index,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { nanoid } from "@zdocs/util";
import { organizationsTbl } from "./organizations";
import { type Institution, INSTITUTION_TYPES } from "@zdocs/types";

export const institutionsTbl = pgTable(
  "institutions",
  {
    id: varchar("id", { length: 191 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    orgId: varchar("org_id", { length: 191 })
      .notNull()
      .references(() => organizationsTbl.id, { onDelete: "cascade" }),

    /** Display name (e.g., "Amazon", "Chase Bank") */
    name: text("name").notNull(),

    /** Normalized name for matching (lowercase, trimmed) */
    normalizedName: text("normalized_name").notNull(),

    /** Type of institution for categorization */
    type: text("type", { enum: INSTITUTION_TYPES }),

    /** Domain for logo/enrichment (e.g., "amazon.com") */
    domain: text("domain"),

    /** Description for search context */
    description: text("description"),

    /** Additional metadata */
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),

    deletedAt: timestamp("deleted_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    // Index for fuzzy matching within org
    orgNameIdx: index("institution_org_name_idx").on(
      table.orgId,
      table.normalizedName
    ),
    // Unique constraint: one normalized name per org
    uniqueOrgName: unique("institution_unique_org_name").on(
      table.orgId,
      table.normalizedName
    ),
    // Index for soft delete filtering
    orgDeletedIdx: index("institution_org_deleted_idx")
      .on(table.orgId)
      .where(sql`deleted_at IS NULL`),
  })
);

// Type compatibility check (will error at build time if incompatible)
const _typeCheck: Institution = {} as typeof institutionsTbl.$inferSelect;

