/**
 * Test-data factories for the activity log, modelled on `@account/mocks/db-utils`
 * and separate from it for the reason the two collections are separate: an
 * entry is not part of an account record, and a test that wants a log does not
 * want six account fields rebuilt to get one.
 */
import { faker } from "@faker-js/faker";
import { Factory, type DeepPartial } from "fishery";
import { ACTIVITY_KINDS, type ActivityKind } from "../helpers/kinds";
import { activity } from "./db";
import type { ActivityEntry } from "../helpers/api";

/**
 * What a summary says, per kind.
 *
 * Kept as real sentences rather than `faker.lorem`: the search box is what half
 * these tests drive, and a test searching for a word needs the word to have
 * been plausible in the first place. Keyed by kind so a `sign-in` entry never
 * reads like a password change.
 */
const SUMMARIES: Record<ActivityKind, readonly string[]> = {
  "sign-in": ["Signed in", "Signed in from a new device", "Signed out"],
  "profile-change": ["Changed your email address", "Updated your bio", "Changed your language"],
  security: ["Password changed", "Two-factor authentication enabled", "Recovery code used"],
};

const DEVICES = ["Chrome on macOS", "Safari on iPhone", "Firefox on Windows"] as const;

/**
 * A complete, schema-valid stored entry.
 *
 *   activityFactory.build({ kind: "security" })
 *   activityFactory.buildList(5)
 *
 * The date walks backwards from now by the sequence number, so a list built in
 * one call is already in a known order and a test asserting "newest first" is
 * asserting against something other than the order it happened to insert in.
 */
export const activityFactory = Factory.define<ActivityEntry>(({ sequence, params }) => {
  const kind =
    (params.kind as ActivityKind | undefined) ?? faker.helpers.arrayElement(ACTIVITY_KINDS);

  return {
    id: faker.string.uuid(),
    kind,
    at: new Date(Date.UTC(2026, 0, 1, 12) - sequence * 3_600_000).toISOString(),
    summary: faker.helpers.arrayElement(SUMMARIES[kind]),
    device: faker.helpers.arrayElement(DEVICES),
    note: "",
  };
});

/**
 * Builds one entry and puts it in the mock store, handing the record back.
 *
 *   const entry = await seedEntry({ summary: "Signed in from Berlin" });
 */
export async function seedEntry(overrides: DeepPartial<ActivityEntry> = {}) {
  return activity.create(activityFactory.build(overrides));
}

/**
 * The same for a whole log, in one call.
 *
 * The inserts go in together rather than one after the other: nothing downstream
 * reads insertion order — the page sorts by `at` before rendering — so making
 * each row wait for the one before it would buy a slower setup and nothing else.
 */
export async function seedActivity(overrides: readonly DeepPartial<ActivityEntry>[]) {
  return Promise.all(overrides.map((entry) => seedEntry(entry)));
}
