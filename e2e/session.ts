/**
 * One test's slice of the real backend - both halves of it.
 *
 * The account API in server/Accounts/ keys its store by a session id, so parallel
 * specs do not overwrite each other's account, and the notifications service in
 * server/Notifications/ keys its outbox by the same id, because the API
 * forwards it. A test calls `startSession` in its GIVEN, and from then on the
 * browser it drives is talking about records no other spec can reach, in either
 * process.
 *
 * Deliberately plain functions rather than Playwright fixtures: the seeding is
 * part of what each spec is SAYING (given a stored account...), and hiding it in
 * an auto fixture would take that sentence out of the test.
 */
import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import type { Account } from "@account/helpers/api";

/** Where the account API actually listens. */
const API_ORIGIN = "http://localhost:3001";

/** Where the service it calls does. A second origin, because the backend is two
 *  deployments (docs/adr/0004) - and reading from it is how a spec proves the
 *  hop happened rather than assuming it. */
const NOTIFICATIONS_ORIGIN = "http://localhost:3002";

/** The origin the app is served from, which is what the cookie must be scoped
 *  to for the browser to send it along with the app's own requests. */
const APP_ORIGIN = "http://localhost:4173";

const SESSION_COOKIE = "e2e-session";
const SESSION_HEADER = "x-e2e-session";

/** One message the notifications service rendered, as it returns it. */
export interface Notification {
  to: string;
  subject: string;
  body: string;
}

/**
 * Gives this test its own session, tells the browser to carry it, and seeds the
 * account the test needs.
 *
 *   const session = await startSession(page, request, account);
 *
 * Returns the id so a spec can read back what the backend did with it. The
 * browser never needs it - it is carried in a cookie the app does not know
 * about - so a spec that only drives the UI can ignore what comes back.
 */
export async function startSession(
  page: Page,
  request: APIRequestContext,
  account: Account,
): Promise<string> {
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

  return id;
}

/**
 * What the notifications service was told about this session, in order.
 *
 * Read from the SECOND process - not from the API the browser talked to - which
 * is the only way to show that the save crossed a service boundary. Seeding
 * through `/__test__/account` sends nothing, so whatever is here was caused by
 * something the spec did through the UI.
 */
export async function readNotifications(
  request: APIRequestContext,
  session: string,
): Promise<Notification[]> {
  const response = await request.get(`${NOTIFICATIONS_ORIGIN}/__test__/notifications`, {
    headers: { [SESSION_HEADER]: session },
  });
  expect(response.ok(), "reading the notifications should succeed").toBe(true);
  return (await response.json()) as Notification[];
}
