/**
 * INTEGRATION TEST - the read-only route.
 *
 * Best practices
 * - Cover the happy path of the page and edges cases.
 */
import { http, HttpResponse } from "msw";
import { expect, it, describe } from "vitest";
import { worker } from "@testing/worker";
import { ACCOUNT_URL } from "../mocks/handlers";
import { createFrenchPhone, seedAccount } from "../mocks/db-utils";
import { renderRoute } from "@testing/render-route";
import { LANGUAGE_LABELS } from "../helpers/validation";

/**
 * The setup function for this file. Apply AHA Testing principle
 */
async function renderAccountPage() {
  const screen = await renderRoute("/account");

  return {
    /**
     * One term's value, e.g. `await valueFor("Email")` - the <dd> after that
     * <dt>. There is no locator for "next sibling", so this resolves a real element
     */
    valueFor: async (term: string) => {
      const definitionTerm = screen.getByText(term, { exact: true });
      await expect.element(definitionTerm).toBeVisible();
      return definitionTerm.element().nextElementSibling;
    },
    text: (value: string) => screen.getByText(value, { exact: true }),
    errorBanner: screen.getByRole("alert"),
    summaryList: screen.getByLabelText("Account summary"),
    editLink: screen.getByRole("link", { name: "Edit your account" }),
    accountForm: screen.getByRole("form", { name: "Account form" }),
  };
}

describe("AccountPage", () => {
  it("shows the loaded account", async () => {
    // Given an account on the server
    const account = await seedAccount();

    // When the user opens the account page
    const page = await renderAccountPage();

    // Then every stored field is on screen
    await expect.element(page.text(account.nom)).toBeVisible();
    await expect.element(page.text(account.prenom)).toBeVisible();
    await expect.element(page.text(account.email)).toBeVisible();
    await expect.element(page.text(account.bio)).toBeVisible();
    // The stored code ("fr") is never shown to a user; the label is.
    await expect.element(page.text(LANGUAGE_LABELS[account.langue])).toBeVisible();
  });

  it("shows the phone the way the form does, not the way it is stored", async () => {
    // Given a phone stored in E.164
    const phone = createFrenchPhone();
    await seedAccount({ telephone: phone.e164 });

    // When the user opens the account page
    const page = await renderAccountPage();

    // Then it is shown in the national format, like the form shows it.
    await expect.element(page.text(phone.national)).toBeVisible();
  });

  it("says so when an optional field is empty", async () => {
    // Given an account with both optional fields left empty
    await seedAccount({ telephone: null, bio: "" });

    // When the user opens the account page
    const page = await renderAccountPage();

    // Then each one says it is missing.
    expect(await page.valueFor("Phone")).toHaveTextContent("Not provided");
    expect(await page.valueFor("Bio")).toHaveTextContent("Not provided");
  });

  it("shows an error and no summary when the account cannot be loaded", async () => {
    // Given a server that fails the load
    worker.use(http.get(ACCOUNT_URL, () => new HttpResponse(null, { status: 500 })));

    // When the user opens the account page
    const page = await renderAccountPage();

    // Then they are told, and are shown no summary at all.
    await expect.element(page.errorBanner).toHaveTextContent("Could not load your account");
    await expect.element(page.summaryList).not.toBeInTheDocument();
  });

  it("leads to the edit form", async () => {
    // Given the account page
    await seedAccount();
    const page = await renderAccountPage();

    // When the user follows the edit link.
    await page.editLink.click();

    // Then the edit form is what they land on
    await expect.element(page.accountForm).toBeVisible();
  });
});
