import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  primaryKey,
  unique,
  boolean,
} from "drizzle-orm/pg-core";
import { nanoid } from "@zdocs/util";
import type { User } from "@zdocs/types";

export const usersTbl = pgTable("users", {
  id: varchar("id", { length: 191 })
    .primaryKey()
    .$defaultFn(() => nanoid()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
  otpValue: text("otp_value"),
  otpExpiresAt: timestamp("otp_expires_at", { mode: "date" }),
  isAdmin: boolean("is_admin").notNull().default(false),
  roles: text("roles").array().notNull().default([]),
  optInEmail: boolean("opt_in_email").notNull().default(true),
  cognitoSub: varchar("cognito_sub", { length: 255 }),
});

// Type compatibility check (will error at build time if incompatible)
const _typeCheckUser: User = {} as typeof usersTbl.$inferSelect;

export const accountsTbl = pgTable(
  "accounts",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .$defaultFn(() => nanoid()),
    userId: varchar("user_id", { length: 191 })
      .notNull()
      .references(() => usersTbl.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: timestamp("expires_at", { mode: "date" }),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(sql`now()`),
  },
  (account) => ({
    providerProviderAccountIdIndex: unique().on(
      account.provider,
      account.providerAccountId
    ),
    pk: primaryKey({ columns: [account.provider, account.providerAccountId] }),
  })
);

export const sessionsTbl = pgTable("sessions", {
  id: varchar("id", { length: 191 })
    .primaryKey()
    .$defaultFn(() => nanoid()),
  sessionToken: text("session_token").notNull().unique(),
  userId: varchar("user_id", { length: 191 })
    .notNull()
    .references(() => usersTbl.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(sql`now()`),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// Schema for user registration and login
// Note: insertUserSchema removed - user registration now handled by Cognito


