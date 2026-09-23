/**
 * The queries, and nothing else: no connection, no HTTP. Each takes the
 * database as its first argument so the same code runs against Postgres in the
 * API and against PGlite in the unit tests (see __tests__/store.unit.test.ts).
 */
import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Account, AccountPayload } from "../src/account/helpers/api.ts";
import { accounts } from "./schema.ts";

/** Any Drizzle Postgres database, whichever driver is behind it. */
export type Database = PgDatabase<PgQueryResultHKT>;

/** Every column but the session: what goes back over the wire. */
const accountColumns = {
  id: accounts.id,
  nom: accounts.nom,
  prenom: accounts.prenom,
  email: accounts.email,
  telephone: accounts.telephone,
  langue: accounts.langue,
  bio: accounts.bio,
};

export async function findAccount(db: Database, session: string): Promise<Account | null> {
  const [found] = await db
    .select(accountColumns)
    .from(accounts)
    .where(eq(accounts.session, session));
  return found ?? null;
}

/** Stores the account for this session, replacing whatever was there. */
export async function saveAccount(
  db: Database,
  session: string,
  account: Account,
): Promise<Account> {
  const [saved] = await db
    .insert(accounts)
    .values({ session, ...account })
    .onConflictDoUpdate({ target: accounts.session, set: account })
    .returning(accountColumns);
  return saved;
}

/**
 * Replaces every field the client may send, and keeps the id: the server owns
 * it, so it is not in the payload and cannot be overwritten by one. Resolves
 * null when the session has no account to update.
 */
export async function updateAccount(
  db: Database,
  session: string,
  payload: AccountPayload,
): Promise<Account | null> {
  const [updated] = await db
    .update(accounts)
    .set(payload)
    .where(eq(accounts.session, session))
    .returning(accountColumns);
  return updated ?? null;
}
