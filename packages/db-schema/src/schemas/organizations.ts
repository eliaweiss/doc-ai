import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { nanoid } from "@zdocs/util";
import { usersTbl } from "./auth";
import type { Organization } from "@zdocs/types";

export const organizationsTbl = pgTable(
  "organizations",
  {
    id: varchar("id", { length: 191 })
      .primaryKey()
      .$defaultFn(() => nanoid()),
    name: text("name").notNull(),
    description: text("description"), // Describes the business activity for AI categorization
    baseCurrency: text("base_currency").notNull().default("USD"), // Default reporting currency
    timezone: text("timezone").notNull().default("UTC"), // Default timezone for the organization
    ownerUserId: varchar("owner_user_id", { length: 191 })
      .notNull()
      .references(() => usersTbl.id, { onDelete: "cascade" }),
    maxPagesPerDoc: integer("max_pages_per_doc").notNull().default(10), // Cost control setting
    sharedWithEmails: text("shared_with_emails")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`), // Access control for external accountants/partners
    webhookId: varchar("webhook_id", { length: 191 }), // Unique ID for webhook URL generation
    webhookSecret: text("webhook_secret"), // Secret for webhook authentication header
    webhookCallbackUrl: text("webhook_callback_url"), // User's server URL for receiving outbound webhook callbacks
    webhookSigningSecret: text("webhook_signing_secret"), // HMAC-SHA256 secret for signing outbound webhook payloads
    emailId: varchar("email_id", { length: 191 }), // Unique ID for email address generation
    emailForwardAddress: text("email_forward_address"), // Email address to forward incoming emails to
    emailForwardEnabled: boolean("email_forward_enabled")
      .notNull()
      .default(false), // Whether to forward emails before processing
    emailNotifyOnUpload: boolean("email_notify_on_upload")
      .notNull()
      .default(false), // Whether to send email notification to user when a new document is uploaded
    color: varchar("color", { length: 7 }), // Hex color code for organization (e.g., #FF5733)
    deletedAt: timestamp("deleted_at", { mode: "date" }), // Soft delete marker
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    ownerUserIdIdx: index("organization_owner_user_id_idx").on(
      table.ownerUserId
    ),
    deletedAtIdx: index("organization_deleted_at_idx").on(table.deletedAt),
    webhookIdIdx: index("organization_webhook_id_idx").on(table.webhookId),
    emailIdIdx: index("organization_email_id_idx").on(table.emailId),
    emailIdUnique: unique("organization_email_id_unique").on(table.emailId),
  })
);

// Type compatibility check (will error at build time if incompatible)
const _typeCheck: Organization = {} as typeof organizationsTbl.$inferSelect;
