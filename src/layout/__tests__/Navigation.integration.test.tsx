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
import { expect, it } from "vitest";
import { seedAccount } from "@account/mocks/db-utils";
import { renderRoute } from "@testing/render-route";

/*
 * Integration: component
 */

/** The setup function for this file. Apply AHA Testing principle */
async function renderNavigationAt(initialPath: string) {
  const screen = await renderRoute(initialPath);
  const navigation = screen.getByRole("navigation", { name: "Main" });

  return {
    navigation,
    homeLink: navigation.getByRole("link", { name: "Home" }),
    accountLink: navigation.getByRole("link", { name: "Your account" }),
    editAccountLink: screen.getByRole("link", { name: "Edit your account" }),
    welcome: screen.getByRole("heading", { name: "Welcome" }),
    accountHeading: screen.getByRole("heading", { name: "Your account" }),
  };
}

// Use case: Reading your account, Editing your account — Happy path
it("marks the current route as the visitor moves from the welcome to the account and the edit form, and Home always returns them to the welcome", async () => {
  // Given an account, and a visitor on the welcome page
  await seedAccount();
  const page = await renderNavigationAt("/");

  // Then Home is marked current, and Your account is not
  await expect.element(page.homeLink).toHaveAttribute("aria-current", "page");
  await expect.element(page.accountLink).not.toHaveAttribute("aria-current");

  // When they follow the account link in the nav
  await page.accountLink.click();

  // Then they land on the summary, and the mark moves with them. Home
  // dropping its mark is the assertion that matters: "/" is a prefix of
  // every route, so it is the one that goes wrong quietly.
  await expect.element(page.accountHeading).toBeVisible();
  await expect.element(page.accountLink).toHaveAttribute("aria-current", "page");
  await expect.element(page.homeLink).not.toHaveAttribute("aria-current");

  // When they open the edit form - a route that is not the nav's own parent -
  // and follow Home from there
  await page.editAccountLink.click();
  await page.homeLink.click();

  // Then they are back on the welcome
  await expect.element(page.welcome).toBeVisible();
});
