/**
 * ⚠️ INTERNAL TABLE - DO NOT IMPORT DIRECTLY
 *
 * This table requires orgId for ALL queries (multi-tenant).
 * Use functions from queries/document-types.ts instead:
 *
 * - getDocumentTypeByNameForOrg(name, orgId)
 * - getDocumentTypesForOrg(orgId)
 * - getDocumentTypesByNamesForOrg(names, orgId)
 * - seedDocumentTypesForOrg(orgId)
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
  unique,
  jsonb,
  index,
  integer,
} from "drizzle-orm/pg-core";
import { nanoid } from "@zdocs/util";
import {
  DocumentTypeRecord,
  FieldDefinition,
  LineItemCollectionSchema,
  FolderMapping,
  SampleDocument,
} from "@zdocs/types";

export const documentTypesTbl = pgTable(
  "document_types",
  {
    id: varchar("id", { length: 191 })
      .primaryKey()
      .$defaultFn(() => nanoid()),

    // Schema version - increments when headerSchema or lineItemSchemas change
    entityVersion: integer("entity_version").default(1).notNull(),

    // REQUIRED - every type belongs to an org (multi-tenant)
    orgId: varchar("org_id", { length: 191 }).notNull(),

    // Type identification
    name: varchar("name", { length: 50 }).notNull(), // "INVOICE", "UTILITY_BILL"
    displayName: varchar("display_name", { length: 100 }), // "Invoice", "Utility Bill"
    description: text("description"), // For AI classification prompt
    extractionHint: text("extraction_hint"), // For AI classification hint

    // Tracks which system template this type originated from (for bulk updates)
    // null = user-created custom type, set = originated from SYSTEM_DOCUMENT_TYPES
    templateName: varchar("template_name", { length: 50 }),

    // Schema definitions
    headerSchema: jsonb("header_schema").$type<FieldDefinition[]>().notNull(),
    lineItemSchemas: jsonb("line_item_schemas").$type<Record<
      string,
      LineItemCollectionSchema
    > | null>(),

    // Dataset identification
    isDataset: boolean("is_dataset").default(false), // true if this is a dataset type

    // Metadata
    isSystem: boolean("is_system").default(false), // Originated from system template
    defaultFolderId: varchar("default_folder_id", { length: 191 }), // Reference to folders table
    folderMapping: jsonb("folder_mapping").$type<FolderMapping[] | null>(),
    icon: varchar("icon", { length: 50 }), // Icon name for UI
    color: varchar("color", { length: 7 }), // Hex color for UI
    sampleDocuments: jsonb("sample_documents").$type<SampleDocument[] | null>(), // Sample documents for schema generation

    deletedAt: timestamp("deleted_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    // Unique type name per org
    uniqueName: unique("document_types_unique_name").on(
      table.orgId,
      table.name
    ),
    // Index for org queries
    orgIdIdx: index("document_types_org_id_idx").on(table.orgId),
  })
);

const _typeCheck: DocumentTypeRecord =
  {} as typeof documentTypesTbl.$inferSelect;
