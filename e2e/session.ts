/**
 * One test's slice of the real backend.
 *
 * The API in server/api.ts keys its store by a session id, so parallel specs do
 * not overwrite each other's account. A test calls `startSession` in its GIVEN,
 * and from then on the browser it drives is talking about a record no other
 * spec can reach.
 *
 * Deliberately a plain function rather than a Playwright fixture: the seeding is
 * part of what each spec is SAYING (given a stored account...), and hiding it in
 * an auto fixture would take that sentence out of the test.
 */
import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import type { Account } from "@account/helpers/api";

/** Where the API actually listens. */
const API_ORIGIN = "http://localhost:3001";

/** The origin the app is served from, which is what the cookie must be scoped
 *  to for the browser to send it along with the app's own requests. */
const APP_ORIGIN = "http://localhost:4173";

const SESSION_COOKIE = "e2e-session";
const SESSION_HEADER = "x-e2e-session";

/**
 * Gives this test its own session, tells the browser to carry it, and seeds the
 * account the test needs.
 *
 *   await startSession(page, request, account);
 *
 * Returns nothing: the id it generates is the browser's business, carried in a
 * cookie the app never sees. A spec that later wants to read the stored record
 * back out of the API is the reason to hand it out - and the reason to add a
 * return type then rather than keep an unused one now.
 */
export async function startSession(
  page: Page,
  request: APIRequestContext,
  account: Account,
): Promise<void> {
  const id = randomUUID();

  // The browser carries the id in a cookie, so every request the APP makes is
  // attributed without the app knowing this mechanism exists. Set before the
  // first navigation: a cookie added later would miss the initial GET.
  await page.context().addCookies([{ name: SESSION_COOKIE, value: id, url: APP_ORIGIN }]);

  const seeded = await request.put(`${API_ORIGIN}/__test__/account`, {
    headers: { [SESSION_HEADER]: id },
    data: account,
  });
  // Asserted rather than assumed: a failed seed would otherwise surface much
  // later, as a page that renders an error, and read as an app bug.
  expect(seeded.status(), "seeding the account should succeed").toBe(201);
}
