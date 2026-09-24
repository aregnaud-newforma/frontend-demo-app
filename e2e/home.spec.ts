/**
 * E2E TEST (Playwright) - best practices
 * - Cover the HAPPY PATH only at this level. E2E is slow and expensive; it exists
 *   to prove the whole flow wires together, not to enumerate edge cases (those
 *   live in the integration and unit tests).
 */
import { test, expect, type Page } from "@playwright/test";
import { accountFactory } from "@account/mocks/db-utils";
import { startSession } from "./session";

/**
 * The nav in the shell, which every route renders. Scoped rather than queried
 * loose because role-name matching is a substring match, and the welcome links
 * to the account in its body too.
 */
const mainNav = (page: Page) => page.getByRole("navigation", { name: "Main" });

test("the root serves the welcome, with the account's preview from its own remote", async ({
  page,
  request,
  baseURL,
}) => {
  // Given a stored account, and a record of every API call the visitor causes.
  //
  // Matched on the ORIGIN as well as the path, because "/api/" on its own is not
  // this app's API - it is a prefix, and Sentry's ingest endpoint happens to
  // share it (`POST /api/<projectId>/envelope/`). With a DSN set, the browser
  // reporting the pageload would be counted here as a fetch the page made.
  // `baseURL` comes from playwright.config.ts, which is where the app's origin
  // is already decided.
  const apiCalls: string[] = [];
  page.on("request", (call) => {
    const { origin, pathname } = new URL(call.url());
    if (origin === baseURL && pathname.startsWith("/api/")) {
      apiCalls.push(`${call.method()} ${pathname}`);
    }
  });

  const account = accountFactory.build();
  await startSession(page, request, account);

  // When they open the root
  await page.goto("/");

  // Then they are welcomed, and stay at "/"
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);

  // ...and the nav says which page they are on.
  await expect(mainNav(page).getByRole("link", { name: "Home" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(mainNav(page).getByRole("link", { name: "Your account" })).not.toHaveAttribute(
    "aria-current",
  );

  // ...and the preview names the account. This is a component of the ACCOUNT
  // remote, rendered inside a page of the HOME remote: the one place in the
  // app where a vertical consumes another over the wire, and the reason this
  // spec cannot be an integration test - only here are the two served from
  // their own origins.
  await expect(page.getByTestId("account-preview")).toContainText(
    `${account.prenom} ${account.nom}`,
  );

  // ...and that preview is the ONLY thing the page fetched. Asserted after the
  // preview is on screen, so its query has already left the browser by the
  // time we look; anything else the welcome asked for would show up here.
  expect(apiCalls).toEqual(["GET /api/account"]);
});

test("the browser's own back and forward buttons follow the nav", async ({ page, request }) => {
  // Given a stored account.
  await startSession(page, request, accountFactory.build());

  // ...and a visitor who has walked from the welcome to their account
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  await mainNav(page).getByRole("link", { name: "Your account" }).click();
  await expect(page).toHaveURL(/\/account$/);

  // When they press the browser's back button rather than a link in the page
  await page.goBack();

  // Then they are back on the welcome.
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  await expect(mainNav(page).getByRole("link", { name: "Home" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  // When they press forward again.
  await page.goForward();

  // Then the account is rendered from that entry.
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  await expect(mainNav(page).getByRole("link", { name: "Your account" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
