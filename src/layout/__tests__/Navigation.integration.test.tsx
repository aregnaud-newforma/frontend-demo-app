/**
 * INTEGRATION TEST - ../Navigation, the shell's map of the app.
 *
 * Its own file rather than an extra test inside the page files, because the nav
 * is not part of any one page: RootLayout renders it, so every route gets it. A
 * check that lived in HomePage's file would only ever prove the nav for "/",
 * and the bug this guards against - a destination that works from one route and
 * not from another - is invisible from a single route.
 *
 * Mounted through the real route tree rather than rendered on its own, even now
 * that it IS its own component. A <Link> outside a router context renders
 * nothing useful, and "the link goes where it says" is a claim about the tree as
 * much as about the markup - so rendering <Navigation /> alone would test only
 * that six words are on screen.
 *
 * Two things are worth proving here, and they are different in kind:
 * - the links GO where they say, which is routing, and
 * - the nav SAYS where you are, via the `aria-current="page"` the router puts on
 *   the active link. That one is easy to break by accident: drop the exact
 *   matching in RootLayout and "/" prefix-matches every route, so Home
 *   announces itself as the current page while you are reading the account.
 *
 * Locators are scoped to the navigation landmark throughout. Page bodies link
 * to the account too, and role-name matching is a substring match, so an
 * unscoped `link named "Your account"` would be ambiguous by construction.
 */
import { expect, it, describe } from "vitest";
import { seedAccount } from "@account/mocks/db-utils";
import { renderRoute } from "@testing/render-route";

/** The setup function for this file. Apply AHA Testing principle */
async function renderNavigationAt(initialPath: string) {
  const screen = await renderRoute(initialPath);
  const navigation = screen.getByRole("navigation", { name: "Main" });

  return {
    navigation,
    homeLink: navigation.getByRole("link", { name: "Home" }),
    accountLink: navigation.getByRole("link", { name: "Your account" }),
    welcome: screen.getByRole("heading", { name: "Welcome" }),
    accountHeading: screen.getByRole("heading", { name: "Your account" }),
  };
}

describe("Navigation", () => {
  it("takes the visitor from the welcome to their account", async () => {
    // Given an account on the server, and a visitor on the welcome page
    await seedAccount();
    const page = await renderNavigationAt("/");

    // When they follow the account link in the nav
    await page.accountLink.click();

    // Then the summary is what they land on
    await expect.element(page.accountHeading).toBeVisible();
  });

  it("takes them back again from any page", async () => {
    // Given the same visitor, deeper in - on the edit form rather than the
    // summary, so this proves the nav from a route that is not its own parent
    await seedAccount();
    const page = await renderNavigationAt("/account/edit");

    // When they follow the home link in the nav
    await page.homeLink.click();

    // Then they are back on the welcome
    await expect.element(page.welcome).toBeVisible();
  });

  it("marks the page the visitor is on, and only that one", async () => {
    // Given a visitor on the welcome page
    await seedAccount();
    const page = await renderNavigationAt("/");

    // Then the nav says so, and says nothing about the other destination
    await expect.element(page.homeLink).toHaveAttribute("aria-current", "page");
    await expect.element(page.accountLink).not.toHaveAttribute("aria-current");

    // When they move to the account
    await page.accountLink.click();
    await expect.element(page.accountHeading).toBeVisible();

    // Then the mark moves with them. Home dropping its mark is the assertion
    // that matters: "/" is a prefix of every route, so it is the one that goes
    // wrong quietly.
    await expect.element(page.accountLink).toHaveAttribute("aria-current", "page");
    await expect.element(page.homeLink).not.toHaveAttribute("aria-current");
  });
});
