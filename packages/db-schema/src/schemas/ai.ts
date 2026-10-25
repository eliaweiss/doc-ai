import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { nanoid } from "@zdocs/util";
import { organizationsTbl } from "./organizations";
import { documentTbl } from "./documents";
import {
  type AiUsageLog,
  AI_USAGE_ENTITY_TYPES, type QueueJob,
  QUEUE_JOB_STATUSES,
  QUEUE_JOB_ACTIONS
} from "@zdocs/types";

/**
 * AI Usage Logs table - tracks every AI interaction for cost analysis and debugging
 */
export const aiUsageLogsTbl = pgTable(
  "ai_usage_logs",
  {
    id: varchar("id", { length: 191 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    orgId: varchar("org_id", { length: 191 })
      .notNull()
      .references(() => organizationsTbl.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    action: text("action").notNull(), // e.g., "CLASSIFY_DOCUMENT", "EXTRACT_DOCUMENT"
    modelGatewayId: varchar("model_gateway_id", { length: 191 }).notNull(), // e.g., "google/gemini-2.5-flash", "google/gemini-2.5-flash-lite"
    modelSlug: varchar("model_slug", { length: 191 }).notNull(), // e.g., "gemini-2.5-flash", "gemini-2.5-flash-lite"
    modelProvider: text("model_provider").notNull(), // e.g., "google", "openai", "anthropic"
    aiProvider: text("ai_provider").notNull().default(""), // The selected AI profile/key (e.g., "aiGatewayFast", "google")
    aiKeyLast4Digits: varchar("ai_key_last_4_digits", { length: 4 }).notNull(), // Last 4 digits of the AI key used
    isGateway: boolean("is_gateway").notNull().default(false), // Whether this request was routed through AI Gateway
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    cachedTokens: integer("cached_tokens"), // Tokens hit in cache (cheaper)
    costMilliCent: integer("cost_milli_cent").notNull(), // Raw AI cost in milli-cents. $1 = 100,000
    appliedCostMilliCent: integer("applied_cost_milli_cent"), // Applied cost with org markup (null if not CREDIT_TOP_UP)
    entityId: varchar("entity_id", { length: 191 }), // Related document or record ID
    entityType: text("entity_type", { enum: AI_USAGE_ENTITY_TYPES }), // DOCUMENT, INVOICE, etc.
    pageNumber: integer("page_number"), // Specific page involved (if applicable)
    metadata: jsonb("metadata"), // Additional metadata
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    // Query by org and time range for cost analysis
    orgTimestampIdx: index("ai_usage_logs_org_timestamp_idx").on(
      table.orgId,
      table.timestamp
    ),
    // Query by org and action for usage breakdown
    orgActionIdx: index("ai_usage_logs_org_action_idx").on(
      table.orgId,
      table.action
    ),
    // Query by entity for debugging specific documents
    entityIdx: index("ai_usage_logs_entity_idx").on(
      table.orgId,
      table.entityId,
      table.entityType
    ),
    // Query by model for cost analysis per model
    orgModelIdx: index("ai_usage_logs_org_model_idx").on(
      table.orgId,
      table.modelGatewayId
    ),
  })
);

// Type compatibility check (will error at build time if incompatible)
const _typeCheck: AiUsageLog = {} as typeof aiUsageLogsTbl.$inferSelect;

/**
 * AI Processing Queue table - manages async document processing jobs with retry support
 *
 * This queue enables:
 * - Automatic retry for rate-limited AI requests
 * - Exponential backoff for failed jobs
 * - Visibility into processing status
 * - Priority-based processing
 */
export const aiProcessingQueueTbl = pgTable(
  "ai_processing_queue",
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

    // Job configuration
    status: text("status", { enum: QUEUE_JOB_STATUSES })
      .notNull()
      .default("PENDING"),
    action: text("action", { enum: QUEUE_JOB_ACTIONS }).notNull(), // OCR, CLASSIFY, or EXTRACT
    priority: integer("priority").notNull().default(0), // Higher = processed first

    // Retry management
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lastError: text("last_error"), // Error message from last attempt
    retryAfter: timestamp("retry_after", { mode: "date" }), // Don't process until this time

    // Timestamps
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    startedAt: timestamp("started_at", { mode: "date" }), // When processing started
    completedAt: timestamp("completed_at", { mode: "date" }), // When completed (success or final failure)
  },
  (table) => ({
    // Primary query: get pending jobs ready for processing
    pendingJobsIdx: index("ai_queue_pending_idx").on(
      table.status,
      table.retryAfter,
      table.priority
    ),
    // Query jobs by org for admin views
    orgStatusIdx: index("ai_queue_org_status_idx").on(
      table.orgId,
      table.status
    ),
    // Find stuck jobs (IN_PROGRESS for too long)
    inProgressIdx: index("ai_queue_in_progress_idx").on(
      table.status,
      table.startedAt
    ),
    // Query by document for status checks
    documentIdx: index("ai_queue_document_idx").on(table.documentId),
  })
);

// Type compatibility check (will error at build time if incompatible)
const _queueTypeCheck: QueueJob =
  {} as typeof aiProcessingQueueTbl.$inferSelect;
