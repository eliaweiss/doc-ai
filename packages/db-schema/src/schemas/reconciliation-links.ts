import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  timestamp,
  jsonb,
  numeric,
  real,
  index,
  text,
} from "drizzle-orm/pg-core";
import { nanoid } from "@zdocs/util";
import { organizationsTbl } from "./organizations";
import {
  type ReconciliationPairObj,
  type ReconciliationSessionOptions,
  type LedgerTraceSessionOptions,
  type SavedLedgerTraceSession,
  RECONCILIATION_LINK_TYPES,
  ReconciliationObjRef,
} from "@zdocs/types";

export const reconciliationLinksTbl = pgTable(
  "reconciliation_links",
  {
    id: varchar("id", { length: 191 })
      .primaryKey()
      .$defaultFn(() => nanoid()),

    orgId: varchar("org_id", { length: 191 })
      .notNull()
      .references(() => organizationsTbl.id, { onDelete: "cascade" }),

    // Generic pointers to source and target entities
    sourceRef: jsonb("source_ref").$type<ReconciliationObjRef>().notNull(),
    targetRef: jsonb("target_ref").$type<ReconciliationObjRef>().notNull(),

    date: varchar("date", { length: 50 }).notNull(),

    // The amount of money moved in this specific link
    amount: real("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(), // ISO currency code

    // Link type and confidence
    type: varchar("type", {
      length: 20,
      enum: RECONCILIATION_LINK_TYPES,
    })
      .notNull()
      .default("manual"), // "manual" | "suggested"
    confidence: real("confidence").notNull().default(1.0), // 1.0 for manual, 0.0-0.99 for AI
    edgeType: varchar("edge_type", { length: 20 }), // paid_by, converted_via, deposited_to, relates_to, duplicates, split_across, partial_payment_of

    // Extra context (e.g., exchange rate, AI reasoning, user notes)
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),

    // Audit fields
    createdBy: varchar("created_by", { length: 191 }), // User ID who created the link
    deletedAt: timestamp("deleted_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    // Query links by org
    orgIdx: index("reconciliation_links_org_idx").on(table.orgId),

    // Find all links FROM a specific entity (outgoing)
    sourceIdx: index("reconciliation_links_source_idx").using(
      "gin",
      sql`${table.sourceRef} jsonb_path_ops`
    ),

    // Find all links TO a specific entity (incoming)
    targetIdx: index("reconciliation_links_target_idx").using(
      "gin",
      sql`${table.targetRef} jsonb_path_ops`
    ),

    // Filter by link type
    typeIdx: index("reconciliation_links_type_idx").on(table.orgId, table.type),
  })
);

// Type compatibility check (will error at build time if incompatible)
export const _typeCheck: ReconciliationPairObj =
  {} as typeof reconciliationLinksTbl.$inferSelect;

/**
 * Saved Reconciliation Sessions - allows users to save and restore reconciliation workbench sessions
 * Stores search parameters and selections for quick resumption
 */
export const savedReconciliationSessionsTbl = pgTable(
  "saved_reconciliation_sessions",
  {
    id: varchar("id", { length: 191 })
      .primaryKey()
      .$defaultFn(() => nanoid()),

    orgId: varchar("org_id", { length: 191 })
      .notNull()
      .references(() => organizationsTbl.id, { onDelete: "cascade" }),

    userId: varchar("user_id", { length: 191 }).notNull(),

    name: varchar("name", { length: 255 }).notNull(),
    description: varchar("description", { length: 1000 }),

    // Source side search parameters
    sourceEntityKey: varchar("source_entity_key", { length: 191 }).notNull(),
    sourceQuery: text("source_query").notNull(),
    sourceDateFrom: varchar("source_date_from", { length: 50 }),
    sourceDateTo: varchar("source_date_to", { length: 50 }),
    sourceSelection: jsonb("source_selection")
      .$type<Array<any>>()
      .notNull()
      .default(sql`'[]'`),

    // Target side search parameters
    targetEntityKey: varchar("target_entity_key", { length: 191 }).notNull(),
    targetQuery: text("target_query").notNull(),
    targetDateFrom: varchar("target_date_from", { length: 50 }),
    targetDateTo: varchar("target_date_to", { length: 50 }),
    targetSelection: jsonb("target_selection")
      .$type<Array<any>>()
      .notNull()
      .default(sql`'[]'`),

    // Link configuration
    amount: varchar("amount", { length: 50 }),
    currency: varchar("currency", { length: 3 }),

    // Options (JSONB for flexible filters)
    options: jsonb("options").$type<ReconciliationSessionOptions | null>(),

    // Timestamps
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    // Index for listing user's sessions within an org
    orgUserIdx: index("saved_reconciliation_sessions_org_user_idx").on(
      table.orgId,
      table.userId
    ),
    // Index for sorting by created date
    createdAtIdx: index("saved_reconciliation_sessions_created_at_idx").on(
      table.createdAt
    ),
  })
);

/**
 * Saved Ledger Trace Sessions - allows users to save and restore reconciliation ledger trace parameters
 */
export const savedLedgerTraceSessionsTbl = pgTable(
  "saved_ledger_trace_sessions",
  {
    id: varchar("id", { length: 191 })
      .primaryKey()
      .$defaultFn(() => nanoid()),

    orgId: varchar("org_id", { length: 191 })
      .notNull()
      .references(() => organizationsTbl.id, { onDelete: "cascade" }),

    userId: varchar("user_id", { length: 191 }).notNull(),

    name: varchar("name", { length: 255 }).notNull(),
    description: varchar("description", { length: 1000 }),

    options: jsonb("options").$type<LedgerTraceSessionOptions>().notNull(),

    // Timestamps
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    // Index for listing user's sessions within an org
    orgUserIdx: index("saved_ledger_trace_sessions_org_user_idx").on(
      table.orgId,
      table.userId
    ),
    // Index for sorting by created date
    createdAtIdx: index("saved_ledger_trace_sessions_created_at_idx").on(
      table.createdAt
    ),
  })
);

// Type compatibility check
const _ledgerTraceSessionTypeCheck: SavedLedgerTraceSession =
  {} as typeof savedLedgerTraceSessionsTbl.$inferSelect;
