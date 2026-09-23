/**
 * The tables, in Drizzle's `pg-core` dialect. drizzle-kit reads this file to
 * generate `migrations/`; the API and the store read it for column types.
 *
 * One account per session, so the session id is the primary key rather than a
 * foreign key on a separate table. It is the same key that isolated parallel
 * E2E specs when the store was a Map (see api.ts, PER-TEST ISOLATION); it
 * became a column instead of a Map key, and nothing else about it changed.
 */
import { pgTable, text } from "drizzle-orm/pg-core";
import type { Language } from "../src/account/helpers/validation.ts";

export const accounts = pgTable("accounts", {
  session: text().primaryKey(),
  id: text().notNull(),
  nom: text().notNull(),
  prenom: text().notNull(),
  email: text().notNull(),
  // E.164, or null when the user cleared it - the same contract as the wire.
  telephone: text(),
  // Typed, not constrained: the API runs on Node's type stripping, which
  // cannot follow the extensionless imports a VALUE import of LANGUAGES would
  // pull in. The form's Zod schema is what rejects an unknown language.
  langue: text().$type<Language>().notNull(),
  bio: text().notNull(),
});
