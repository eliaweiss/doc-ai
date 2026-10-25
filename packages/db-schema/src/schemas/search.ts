import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  index,
  jsonb,
  doublePrecision,
  boolean,
} from "drizzle-orm/pg-core";
import { nanoid } from "@zdocs/util";

import { organizationsTbl } from "./organizations";
import { documentTbl } from "./documents";
import {
  type SearchIndex,
  ENTITY_TYPES,
  type SavedQuery,
  type SavedQueryFilters,
} from "@zdocs/types";

// NOTE: The search index stores ONLY searchable content, NOT metadata.
// Metadata (amount, currency, quantity, etc.) is fetched from source tables
// (documents, document_data) at query time.
// This avoids data duplication and ensures search results always show fresh data.

export const searchIndexTbl = pgTable(
  "search_index",
  {
    entityId: varchar("entity_id", { length: 191 }).primaryKey().notNull(), // The actual entity being indexed (unique identifier)

    orgId: varchar("org_id", { length: 191 })
      .notNull()
      .references(() => organizationsTbl.id, { onDelete: "cascade" }),
    documentId: varchar("document_id", { length: 191 })
      .notNull()
      .references(() => documentTbl.id, { onDelete: "cascade" }),
    entityType: text("entity_type", { enum: ENTITY_TYPES }).notNull(),
    content: text("content").notNull(), // Plain text for searching
    /** Collection key for line items (e.g., "items", "holdings", "activities") */
    collectionKey: varchar("collection_key", { length: 100 }),
    /** Compound schema identifier: "{docType}_{collectionKey}" or "{docType}_header" */
    schemaType: varchar("schema_type", { length: 200 }).notNull(),
    docType: varchar("doc_type", { length: 100 }).notNull(),
    date: text("date").notNull(),
    description: text("description").notNull(), // description of the entity - show in quick view
    amount: doublePrecision("amount").notNull(), // amount of the entity - show in quick view
    currency: varchar("currency", { length: 3 }).notNull(), // currency of the entity
    isDataset: boolean("is_dataset").notNull().default(false), // Whether the source document is a dataset
    isDuplicate: boolean("is_duplicate").notNull().default(false), // User-marked duplicate flag (mirror of line item's isDuplicate)
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    // Main search index by org and entity type
    orgEntityTypeIdx: index("search_index_org_entity_type_idx").on(
      table.orgId,
      table.entityType
    ),
    // For looking up all index entries for a document
    documentIdx: index("search_index_document_idx").on(table.documentId),
    // For finding existing index entry for an entity
    entityIdx: index("search_index_entity_idx").on(
      table.orgId,
      table.entityId,
      table.entityType
    ),
    // GIN Index for Full-Text Search on content
    searchContentIdx: index("search_index_search_content_idx").using(
      "gin",
      sql`to_tsvector('english', ${table.content})`
    ),
    // GIN Index for Trigram typo-tolerant search on content
    contentTrgmIdx: index("search_index_content_trgm_idx").using(
      "gin",
      sql`${table.content} gin_trgm_ops`
    ),
  })
);

// Type compatibility check (will error at build time if incompatible)
const _typeCheck: SearchIndex = {} as typeof searchIndexTbl.$inferSelect;

export const savedQueryTbl = pgTable(
  "saved_queries",
  {
    id: varchar("id", { length: 191 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    orgId: varchar("org_id", { length: 191 })
      .notNull()
      .references(() => organizationsTbl.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 191 }).notNull(),
    name: text("name").notNull(),
    query: text("query").notNull(),
    filters: jsonb("filters").$type<SavedQueryFilters | null>(),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    // Index for listing user's queries within an org
    orgUserIdx: index("saved_query_org_user_idx").on(table.orgId, table.userId),
  })
);

// Type compatibility check (will error at build time if incompatible)
const _savedQueryTypeCheck: SavedQuery =
  {} as typeof savedQueryTbl.$inferSelect;
