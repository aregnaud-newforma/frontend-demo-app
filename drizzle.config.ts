/**
 * drizzle-kit's config, for `yarn db:generate`: diff server/schema.ts against
 * the last snapshot and write the SQL into server/migrations/. Applying them
 * is the API's own job at startup (server/db.ts), so no connection is declared
 * here - generation is a pure function of the schema and the snapshots.
 */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./server/schema.ts",
  out: "./server/migrations",
});
