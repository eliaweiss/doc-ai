import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  index,
  jsonb,
  doublePrecision,
  numeric,
  boolean,
  date,
  unique,
} from "drizzle-orm/pg-core";
import { nanoid } from "@zdocs/util";
import { organizationsTbl } from "./organizations";
import { institutionsTbl } from "./institutions";
import {
  type Document,
  DocumentData,
  DocumentNotification,
  EXTRACTION_STATUSES,
  OcrResultPtr,
  TRANSACTION_TYPES,
} from "@zdocs/types";
import { documentTypesTbl } from "./document-types";

export const documentTbl = pgTable(
  "documents",
  {
    id: varchar("id", { length: 191 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    orgId: varchar("org_id", { length: 191 })
      .notNull()
      .references(() => organizationsTbl.id, { onDelete: "cascade" }),
    folderId: varchar("folder_id", { length: 191 }).notNull(), // FK -> folders.id (null = root/unfiled)

    // Type name (e.g., "INVOICE", "BANK_STATEMENT")
    // All lookups use (orgId + docType)
    docType: text("doc_type"), // Null until AI processing determines the type

    // File Information
    fileName: text("file_name"), // Original name without extension
    fileExtension: text("file_extension"), // e.g., "pdf", "jpg", "png"
    contentType: text("content_type").notNull(), // MIME type (e.g., "application/pdf", "image/png")
    s3Key: text("s3_key").notNull(), // Path in storage bucket
    contentHash: text("content_hash"), // MD5/SHA256 for duplicate prevention
    pageCount: integer("page_count"), // Total pages in the file
    processedPages: integer("processed_pages").array(), // e.g., [1, 5, 2, 3]

    // Extraction State
    extractionVersion: varchar("extraction_version", { length: 191 })
      .default(process.env.EXTRACTION_VERSION || "1")
      .notNull(), // Version of extraction pipeline
    extractionStatus: text("extraction_status", { enum: EXTRACTION_STATUSES })
      .notNull()
      .default("PENDING"),
    lastExtractedAt: timestamp("last_extracted_at", { mode: "date" }), // When extraction last completed/attempted
    lastIndexedAt: timestamp("last_indexed_at", { mode: "date" }), // When search indexing last completed
    extractionErrors: jsonb("extraction_errors").$type<Record<
      string,
      unknown
    > | null>(), // Structured error info

    // Counterparty (Common to all document types)
    // Institution ID - name is looked up from institutions table when needed
    institutionId: varchar("institution_id", { length: 191 }).references(
      () => institutionsTbl.id,
      { onDelete: "set null" }
    ),

    // Currency (Common to all document types)
    currency: text("currency"), // Document's original currency (e.g., "USD")
    exchangeRateToBase: numeric("exchange_rate_to_base"), // Rate where amount * exchangeRateToBase = baseAmount

    // Description & Context
    description: text("description"), // User-provided or AI-generated summary

    // Document Date (extracted from document - invoice date, statement date, etc.)
    documentDate: varchar("document_date", { length: 50 }),

    // OCR Result
    ocrResultPtr: jsonb("ocr_result_ptr").$type<OcrResultPtr>(),

    // Storage Info
    s3Region: text("s3_region").notNull(), // AWS region where file is stored
    s3Bucket: text("s3_bucket").notNull(), // S3 bucket name

    // Upload State
    uploadComplete: boolean("upload_complete").notNull().default(false), // True when file upload to S3 is complete, triggers AI processing

    // Meta
    isTest: boolean("is_test").notNull().default(false), // Test documents for development/QA
    isDataset: boolean("is_dataset").notNull().default(false), // true if this is a dataset
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(), // For unclassified/extra extractions
    deletedAt: timestamp("deleted_at", { mode: "date" }), // Soft delete marker
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    // Core query patterns
    orgTypeCreatedIdx: index("document_org_type_created_idx").on(
      table.orgId,
      table.docType,
      table.createdAt
    ),
    orgStatusIdx: index("document_org_status_idx").on(
      table.orgId,
      table.extractionStatus
    ),
    // For folder-based queries
    orgFolderIdx: index("document_org_folder_idx").on(
      table.orgId,
      table.folderId,
      table.createdAt
    ),
    // For soft delete filtering (partial index on non-deleted records)
    activeIdx: index("document_active_idx")
      .on(table.orgId, table.docType)
      .where(sql`deleted_at IS NULL`),
    // For duplicate detection
    contentHashIdx: index("document_content_hash_idx").on(
      table.orgId,
      table.contentHash
    ),
  })
);

// Type compatibility check (will error at build time if incompatible)
const _typeCheck: Document = {} as typeof documentTbl.$inferSelect;

// Document Data table - stores extracted data for the unified schema
export const documentDataTbl = pgTable(
  "document_data",
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

    // Tracks the entityVersion of the document type schema used for this extraction
    schemaEntityVersion: integer("schema_entity_version").notNull().default(1),

    // Type ID is NOT stored here, it's on the parent documents table
    // This avoids data duplication and consistency issues

    // ═══════════════════════════════════════════════════════════════════
    // THE CORE JSONB FIELDS
    // ═══════════════════════════════════════════════════════════════════

    // Header data - validated against document_types.headerSchema
    // Example for INVOICE: { invoiceNumber: "INV-001", total: 500.00, ... }
    headerData: jsonb("header_data").$type<Record<string, unknown>>(),

    // Line items - validated against document_types.lineItemSchemas
    // Named collections: { items: [...], fees: [...], taxes: [...] }
    lineItems: jsonb("line_items").$type<Record<
      string,
      Record<string, unknown>[]
    > | null>(),

    // ═══════════════════════════════════════════════════════════════════
    // DENORMALIZED FIELDS (for fast filtering without JSONB parsing)
    // ═══════════════════════════════════════════════════════════════════

    // Extracted from headerData for common queries
    totalAmount: doublePrecision("total_amount"),
    transactionType: text("transaction_type", { enum: TRANSACTION_TYPES }),
    documentDate: text("document_date")
      .notNull()
      .default(sql`now()`),
    dueDate: text("due_date"),

    // Converted to org's base currency
    baseAmount: doublePrecision("base_amount"),

    // Notifications generated by formula fields
    // For warning/error: includes id referencing notifications table
    // For info: no id, not persisted to notifications table
    notifications: jsonb("notifications").$type<
      DocumentNotification[] | null
    >(),

    // Soft delete
    deletedAt: timestamp("deleted_at", { mode: "date" }),
    documentDeletedAt: timestamp("document_deleted_at", { mode: "date" }), // Cascaded from parent document

    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    // Fast lookup by document
    documentIdx: unique("document_data_document_idx").on(table.documentId),

    // Date range queries
    dateIdx: index("document_data_date_idx")
      .on(table.orgId, table.documentDate)
      .where(sql`deleted_at IS NULL`),

    // Amount filtering
    amountIdx: index("document_data_amount_idx")
      .on(table.orgId, table.totalAmount)
      .where(sql`deleted_at IS NULL`),

    // GIN index for JSONB full-text search within headerData
    headerGinIdx: index("document_data_header_gin_idx").using(
      "gin",
      sql`${table.headerData} jsonb_path_ops`
    ),

    // GIN index for line items search
    itemsGinIdx: index("document_data_items_gin_idx").using(
      "gin",
      sql`${table.lineItems} jsonb_path_ops`
    ),
  })
);

// Type compatibility check (will error at build time if incompatible)
const _typeCheck1: DocumentData = {} as typeof documentDataTbl.$inferSelect;
