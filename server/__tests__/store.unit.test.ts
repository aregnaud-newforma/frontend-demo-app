/**
 * UNIT TEST - ../store: findAccount, saveAccount, updateAccount.
 *
 * Against PGlite, Postgres compiled to WebAssembly, brought to the current
 * schema by the same migrations the API applies at startup. So this proves the
 * committed SQL and the queries agree, with no service to run - and a
 * migration that drifts from the schema fails here, in the Node tier, before
 * anything reaches a real database.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import type { Account, AccountPayload } from "../../src/account/helpers/api.ts";
import { MIGRATIONS_FOLDER } from "../db.ts";
import { findAccount, saveAccount, updateAccount } from "../store.ts";

const account: Account = {
  id: "acc_1",
  nom: "Lovelace",
  prenom: "Ada",
  email: "ada@example.com",
  telephone: "+33612345678",
  langue: "fr",
  bio: "Mathematician",
};

const payload: AccountPayload = {
  nom: "King",
  prenom: "Augusta",
  email: "augusta@example.com",
  telephone: null,
  langue: "en",
  bio: "Countess",
};

let db: PgliteDatabase;

// A fresh database per test: the isolation between sessions is one of the
// things under test, so no test may inherit another's rows.
beforeEach(async () => {
  db = drizzle(new PGlite());
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
});

describe("findAccount", () => {
  it("resolves null for a session that has no account", async () => {
    // Act
    const found = await findAccount(db, "unknown");
    // Assert
    expect(found).toBeNull();
  });

  it("returns what saveAccount stored for that session, without the session", async () => {
    // Arrange
    await saveAccount(db, "s1", account);
    // Act
    const found = await findAccount(db, "s1");
    // Assert
    expect(found).toEqual(account);
  });

  it("does not see another session's account", async () => {
    // Arrange
    await saveAccount(db, "s1", account);
    // Act
    const found = await findAccount(db, "s2");
    // Assert
    expect(found).toBeNull();
  });
});

describe("saveAccount", () => {
  it("replaces the account already stored for the session", async () => {
    // Arrange
    await saveAccount(db, "s1", account);
    const replacement: Account = { ...account, id: "acc_2", email: "other@example.com" };
    // Act
    await saveAccount(db, "s1", replacement);
    // Assert
    expect(await findAccount(db, "s1")).toEqual(replacement);
  });
});

describe("updateAccount", () => {
  it("replaces every field but keeps the server-owned id", async () => {
    // Arrange
    await saveAccount(db, "s1", account);
    // Act
    const updated = await updateAccount(db, "s1", payload);
    // Assert
    expect(updated).toEqual({ id: account.id, ...payload });
    expect(await findAccount(db, "s1")).toEqual({ id: account.id, ...payload });
  });

  it("resolves null, and stores nothing, for a session that has no account", async () => {
    // Act
    const updated = await updateAccount(db, "missing", payload);
    // Assert
    expect(updated).toBeNull();
    expect(await findAccount(db, "missing")).toBeNull();
  });
});
