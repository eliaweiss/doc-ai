import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { nanoid } from "@zdocs/util";
import { organizationsTbl } from "./organizations";
import { FOLDER_TYPES, type Folder } from "@zdocs/types";

export const foldersTbl = pgTable(
  "folders",
  {
    id: varchar("id", { length: 191 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    orgId: varchar("org_id", { length: 191 })
      .notNull()
      .references(() => organizationsTbl.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    parentId: varchar("parent_id", { length: 191 }), // Self-reference for hierarchy (null = root level)
    type: text("type", { enum: FOLDER_TYPES }).notNull().default("GENERAL"), // Classification for reporting
    isSystem: boolean("is_system").notNull().default(false), // True for auto-created default folders
    isRoot: boolean("is_root").notNull().default(false), // True only for "My Drive" root folder
    description: text("description"), // Additional context for AI categorization
    color: text("color"), // For UI display (hex code)
    documentCount: integer("document_count").notNull().default(0), // Denormalized count for display
    deletedAt: timestamp("deleted_at", { mode: "date" }), // Soft delete marker
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    orgParentIdx: index("folders_org_parent_idx").on(table.orgId, table.parentId),
    orgSystemIdx: index("folders_org_system_idx").on(table.orgId, table.isSystem),
    deletedAtIdx: index("folders_deleted_at_idx").on(table.deletedAt),
  })
);

// Type compatibility check (will error at build time if incompatible)
const _typeCheck: Folder = {} as typeof foldersTbl.$inferSelect;

