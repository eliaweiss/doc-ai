/**
 * ⚠️ INTERNAL TABLE - DO NOT IMPORT DIRECTLY
 *
 * doc-ai: the model chosen for each AI action (Settings → Processing).
 * Actions without a row use the default from AI_MODEL_MAP.
 * Use functions from queries/ai-model-settings.ts instead.
 *
 * @internal
 */
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { organizationsTbl } from "./organizations";

export const aiModelSettingsTbl = pgTable(
  "ai_model_settings",
  {
    orgId: varchar("org_id", { length: 191 })
      .notNull()
      .references(() => organizationsTbl.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 64 }).notNull(), // AiUsageAction
    modelProvider: text("model_provider").notNull(), // e.g. "google"
    modelSlug: text("model_slug").notNull(), // e.g. "gemini-3-flash"
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.orgId, table.action] }),
  })
);
