/**
 * E2E TEST (Playwright) - best practices
 * - Cover the HAPPY PATH only at this level. E2E is slow and expensive; it exists
 *   to prove the whole flow wires together, not to enumerate edge cases (those
 *   live in the integration and unit tests).
 */
import { test, expect, type Page } from "@playwright/test";
import { createUser } from "@account/mocks/db-utils";
import { startSession } from "./session";

/**
 * The nav in the shell, which every route renders. Scoped rather than queried
 * loose because role-name matching is a substring match, and the welcome links
 * to the account in its body too.
 */
const mainNav = (page: Page) => page.getByRole("navigation", { name: "Main" });

test("the root serves the welcome", async ({ page }) => {
  // Given a visitor about to arrive, and a record of every API call they cause.
  const apiCalls: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith("/api/")) apiCalls.push(`${request.method()} ${pathname}`);
  });

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

  // ...and nothing was fetched. Asserted after the heading is on screen, so a
  // query fired on mount has already left the browser by the time we look.
  expect(apiCalls).toEqual([]);
});

test("the browser's own back and forward buttons follow the nav", async ({ page, request }) => {
  // Given a stored account.
  await startSession(page, request, createUser());

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
