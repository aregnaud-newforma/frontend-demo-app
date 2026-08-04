/**
 * INTEGRATION TEST - the landing route.
 *
 * The shortest file in the suite, because the page is the shortest: no query,
 * no form, so there is no loading branch, no error branch and no state to get
 * wrong. What is left is worth exactly two tests - that "/" now RENDERS rather
 * than forwarding, and that the way out of it works.
 *
 * The first of those is the real one. "/" used to `throw redirect(...)`, and
 * the failure mode of putting a page there is that something re-adds the
 * forward and the welcome silently stops being reachable; asserting on the
 * welcome heading at "/" is what would catch it. The nav gets its own file
 * (@layout/__tests__/Navigation.integration.test.tsx) because it belongs to
 * the shell, not to this page.
 *
 * Same rules as the account pages: a real Chromium, the real route tree over a
 * memory history, queries by role.
 */
import { expect, it, describe } from "vitest";
import { seedAccount } from "@account/mocks/db-utils";
import { renderRoute } from "@testing/render-route";

/** The setup function for this file. Apply AHA Testing principle */
async function renderHomePage() {
  const screen = await renderRoute("/");

  return {
    welcome: screen.getByRole("heading", { name: "Welcome" }),
    accountHeading: screen.getByRole("heading", { name: "Your account" }),
    // Scoped to <main>: the nav also holds a link to the account, and an
    // unscoped name match would find whichever comes first in the DOM rather
    // than the one this file is about.
    callToAction: screen.getByRole("main").getByRole("link", { name: "Go to your account" }),
  };
}

describe("HomePage", () => {
  it("welcomes the visitor at the root", async () => {
    // Given nothing seeded - the page asks the API for nothing

    // When the user opens the root
    const page = await renderHomePage();

    // Then they are welcomed, rather than forwarded to the account summary the
    // way "/" used to forward them.
    await expect.element(page.welcome).toBeVisible();
    await expect.element(page.accountHeading).not.toBeInTheDocument();
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
