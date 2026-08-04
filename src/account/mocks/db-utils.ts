/**
 * Test-data factories - the single place that knows how to build a *valid*
 * account, shared by the integration and the E2E test.
 *
 * Why a module instead of Faker calls inlined in each test:
 * - One definition of "a valid account". When the schema gains a field, one file
 *   changes and every test keeps compiling (TypeScript points at the factory).
 * - Tests read as intent, not as data plumbing: a test that cares about the
 *   email overrides only the email, and the noise of the other five fields
 *   disappears - which also makes it obvious what the test is really about.
 * - Randomized-but-valid values every run surface accidental dependencies on a
 *   specific string, while `overrides` keeps the parts a test asserts on
 *   explicit and deterministic.
 * - Values that must not collide are enforced here (see UniqueEnforcer) rather
 *   than being hoped for at each call site.
 *
 * Modelled on the Epic Stack's tests/db-utils.ts.
 */
import { faker } from "@faker-js/faker";
import { UniqueEnforcer } from "enforce-unique";
import { LANGUAGES, type AccountValues } from "../helpers/validation";
import type { Account } from "../helpers/api";
import { accounts } from "./db";

// Faker will happily hand out the same email twice in one run. That is fine
// today, but the moment a test asserts "the account with THIS email", a
// duplicate turns into a rare, confusing failure. Enforce it at the source.
const uniqueEmailEnforcer = new UniqueEnforcer();

export function createEmail() {
  return uniqueEmailEnforcer.enforce(() => faker.internet.email()).toLowerCase();
}

/**
 * A valid French mobile/landline number, in the three shapes this app deals in:
 * what a user types, what the server stores, and what the form displays.
 *
 * Returning them together is the point: a test can feed one form and assert on
 * another, so the normalization contract is checked against a value that changes
 * every run - without the test re-deriving it through the very parser under test.
 */
export function createFrenchPhone() {
  // Rule (see ../helpers/phone.ts): 0, then a group digit 1-9, then 8 free digits.
  const national = `0${faker.number.int({ min: 1, max: 9 })}${faker.string.numeric(8)}`;
  return {
    // French numbers are read out in pairs: "06 12 34 56 78".
    formatted: national.match(/.{2}/g)!.join(" "),
    // What the form shows after loading an account: "0612345678".
    national,
    // What the server stores: "+33612345678".
    e164: `+33${national.slice(1)}`,
  };
}

/**
 * A complete, schema-valid *stored* account - the server's shape, phone in
 * E.164. Use `seedAccount` unless you specifically want the object without
 * putting it in the store.
 */
export function createUser(overrides: Partial<Account> = {}): Account {
  return {
    id: faker.string.uuid(),
    nom: faker.person.lastName(),
    prenom: faker.person.firstName(),
    email: createEmail(),
    telephone: createFrenchPhone().e164,
    langue: faker.helpers.arrayElement(LANGUAGES),
    bio: faker.lorem.sentence(),
    ...overrides,
  };
}

/**
 * Puts an account in the mock db so the GET has something to return, and hands
 * it back so the test can assert against what it seeded.
 *
 *   const account = await seedAccount({ telephone: phone.e164 });
 */
export async function seedAccount(overrides: Partial<Account> = {}) {
  return accounts.create(createUser(overrides));
}

/**
 * A complete, schema-valid set of *form* values - the shape the user edits,
 * phone in the national format the form displays. Pass `overrides` for the
 * fields the test actually cares about:
 *
 *   createAccountValues({ email: "not-an-email" })
 */
export function createAccountValues(overrides: Partial<AccountValues> = {}): AccountValues {
  return {
    nom: faker.person.lastName(),
    prenom: faker.person.firstName(),
    email: createEmail(),
    telephone: createFrenchPhone().formatted,
    langue: faker.helpers.arrayElement(LANGUAGES),
    bio: faker.lorem.sentence(),
    ...overrides,
  };
}
