/**
 * INTEGRATION TEST - the landing route.
 *
 * A short file, because the page has little of its own: no form, no query. What
 * it does have is a component borrowed from the account vertical - the
 * preview - and that is what the file is mostly about: that the welcome shows
 * whose account this is, and that it still welcomes when the account cannot be
 * loaded. The two failure modes worth a test are that "/" stops rendering
 * (it used to `throw redirect(...)`) and that a broken preview takes the page
 * down with it.
 *
 * What is NOT here is the remote itself. `account/preview` resolves from
 * source in this tier (alias.ts), so a preview that cannot be FETCHED - the
 * account deployment down - is the e2e tier's to prove, not this one's.
 *
 * The nav gets its own file (@layout/__tests__/Navigation.integration.test.tsx)
 * because it belongs to the shell, not to this page.
 *
 * Same rules as the account pages: a real Chromium, the real route tree over a
 * memory history, queries by role.
 */
import { expect, it, describe } from "vitest";
import { seedAccount } from "@account/mocks/db-utils";
import { renderRoute } from "@demo/testing/render-route";
import { app } from "../../app-under-test";

/** The setup function for this file. Apply AHA Testing principle */
async function renderHomePage() {
  const screen = await renderRoute("/", app);

  return {
    welcome: screen.getByRole("heading", { name: "Welcome" }),
    preview: screen.getByTestId("account-preview"),
    previewError: screen.getByRole("alert"),
    accountHeading: screen.getByRole("heading", { name: "Your account" }),
    // Scoped to <main>: the nav also holds a link to the account, and an
    // unscoped name match would find whichever comes first in the DOM rather
    // than the one this file is about.
    callToAction: screen.getByRole("main").getByRole("link", { name: "Go to your account" }),
  };
}

describe("HomePage", () => {
  it("welcomes the visitor at the root, and says whose account this is", async () => {
    // Given an account on the server
    const account = await seedAccount();

    // When the user opens the root
    const page = await renderHomePage();

    // Then they are welcomed, rather than forwarded to the account summary the
    // way "/" used to forward them...
    await expect.element(page.welcome).toBeVisible();
    await expect.element(page.accountHeading).not.toBeInTheDocument();

    // ...and the preview names the account, with the fields the account
    // vertical chose to show - this page never saw the API.
    await expect.element(page.preview).toHaveTextContent(`${account.prenom} ${account.nom}`);
    await expect.element(page.preview).toHaveTextContent(account.email);
  });

  it("still welcomes the visitor when the account cannot be loaded", async () => {
    // Given no account on the server, so the preview's query fails

    // When the user opens the root
    const page = await renderHomePage();

    // Then the preview says so, in its own slot, and the rest of the page is
    // untouched: the welcome and the way to the account are both still there.
    await expect.element(page.previewError).toHaveTextContent("Could not load your account.");
    await expect.element(page.welcome).toBeVisible();
    await expect.element(page.callToAction).toBeVisible();
  });

  it("leads to the account", async () => {
    // Given an account on the server, so the page it links to can load
    await seedAccount();
    const page = await renderHomePage();

    // When the user follows the call to action
    await page.callToAction.click();

    // Then the summary is what they land on
    await expect.element(page.accountHeading).toBeVisible();
  });
});
