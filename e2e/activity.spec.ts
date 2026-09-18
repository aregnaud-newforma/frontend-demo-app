/**
 * E2E TEST (Playwright) - best practices
 * - Cover the HAPPY PATH only at this level. E2E is slow and expensive; it exists
 *   to prove the whole flow wires together, not to enumerate edge cases (those
 *   live in the integration and unit tests).
 *
 * What only this tier can prove for the activity log: the search term the page
 * puts in the query string is the parameter the real server filters on, and a
 * saved note survives a reload. The integration suite drives both against MSW,
 * where the handler is this repository's own idea of the API agreeing with
 * itself.
 */
import { test, expect } from "@playwright/test";
import { accountFactory } from "@account/mocks/db-utils";
import { activityFactory } from "@activity/mocks/db-utils";
import { startSession } from "./session";

// Use case: Reading your activity, Annotating an entry — Happy path
test("visitor searches their activity, notes an entry, and the note survives a reload", async ({
  page,
  request,
}) => {
  // Given an account and a log stored in the real API, in this test's own
  // session so the specs running beside it cannot touch either.
  const account = accountFactory.build();
  const signIn = activityFactory.build({
    kind: "sign-in",
    summary: "Signed in from a new device",
    device: "Chrome on macOS",
  });
  const passwordChange = activityFactory.build({
    kind: "security",
    summary: "Password changed",
    device: "Firefox on Windows",
  });
  await startSession(page, request, account, [signIn, passwordChange]);

  // When the visitor opens the activity page from the nav
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Activity" })
    .click();

  // Then the whole log is there
  await expect(page.getByRole("heading", { name: "Account activity" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Showing 2 of 2 entries");

  // When they search for a word only one entry carries. The request goes to the
  // real server, which does the filtering - the page never sees the other row.
  await page.getByLabel("Search activity").fill("password");

  // Then only that entry is left, counted against the whole log
  await expect(page.getByRole("status")).toHaveText("Showing 1 of 2 entries");
  await expect(page.getByRole("button", { name: /Password changed/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Signed in from a new device/ })).toBeHidden();

  // When they pick it and write a note
  await page.getByRole("button", { name: /Password changed/ }).click();
  await page.getByLabel("Your note").fill("Rotated after the laptop swap.");
  await page.getByRole("button", { name: "Save note", exact: true }).click();

  // Then the row says it carries one
  await expect(page.getByRole("button", { name: /Password changed/ })).toContainText("noted");

  // And it is still there after a reload, which is the only way to tell a
  // stored note from one that never left the browser.
  await page.reload();
  await page.getByRole("button", { name: /Password changed/ }).click();
  await expect(page.getByLabel("Your note")).toHaveValue("Rotated after the laptop swap.");
});
