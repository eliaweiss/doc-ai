/**
 * INTERNAL TABLE - DO NOT IMPORT DIRECTLY
 *
 * Use functions from queries/document-metadata.ts instead.
 *
 * @internal
 */
import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { nanoid } from "@zdocs/util";
import { organizationsTbl } from "./organizations";
import { documentTbl } from "./documents";
import type { DocumentMetadata } from "@zdocs/types";

export const documentMetadataTbl = pgTable(
  "document_metadata",
  {
    id: varchar("id", { length: 191 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    orgId: varchar("org_id", { length: 191 })
      .notNull()
      .references(() => organizationsTbl.id, { onDelete: "cascade" }),
    documentId: varchar("document_id", { length: 191 })
      .notNull()
      .references(() => documentTbl.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    docTypeUnique: unique("document_metadata_doc_type_unique").on(
      table.documentId,
      table.type
    ),
  })
);

const _typeCheck: DocumentMetadata =
  {} as typeof documentMetadataTbl.$inferSelect;
