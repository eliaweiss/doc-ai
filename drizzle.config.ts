import { defineConfig } from "drizzle-kit";

// Migrations are generated from the zdocs schema copied into packages/db-schema
// and applied at startup by apps/server/src/db.ts (PGlite migrator).
export default defineConfig({
  dialect: "postgresql",
  schema: "./packages/db-schema/src/schemas/index.ts",
  out: "./packages/db-schema/migrations",
});
