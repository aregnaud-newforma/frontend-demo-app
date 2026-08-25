/**
 * Integration coverage for AccountPage - the account summary a visitor lands
 * on at "/account".
 */
import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { worker } from "@testing/worker";
import { deferred } from "@testing/deferred";
import { renderRoute } from "@testing/render-route";
import { accounts } from "../mocks/db";
import { ACCOUNT_URL } from "../mocks/handlers";
import { createFrenchPhone, seedAccount } from "../mocks/db-utils";
import { LANGUAGE_LABELS } from "../helpers/validation";

/*
 * Integration: page
 */

/**
 * The setup function for this file. Apply AHA Testing principle.
 */
async function renderAccountPage() {
  const screen = await renderRoute("/account");

  return {
    // exact: true - "Edit your account" is a substring match on "Your account"
    // otherwise, and the Happy path journey needs this heading gone once it
    // navigates there.
    heading: () => screen.getByRole("heading", { name: "Your account", exact: true }),
    loadingIndicator: () => screen.getByRole("status"),
    errorBanner: () => screen.getByRole("alert"),
    editLink: () => screen.getByRole("link", { name: "Edit your account" }),
    editFormHeading: () => screen.getByRole("heading", { name: "Edit your account" }),
    /** One field's value on the summary, paired with its own term, e.g.
     *  summaryValue("Email") - proving the pairing, not just that the text is
     *  somewhere on the page. exact: true - "Name" is a case-insensitive
     *  substring of "First name" otherwise. */
    summaryValue: (term: string) => screen.getByRole("group", { name: term, exact: true }),

    followEditLink: () => screen.getByRole("link", { name: "Edit your account" }).click(),
  };
}

// Use case: Reading your account — Default render
it("shows a loading state, then every stored field once the account arrives", async () => {
  // Given a stored account, with its GET held open
  const phone = createFrenchPhone();
  const account = await seedAccount({ telephone: phone.e164 });
  const { promise: accountArrives, resolve: releaseAccount } = deferred<void>();
  worker.use(
    http.get(ACCOUNT_URL, async () => {
      await accountArrives;
      return HttpResponse.json(accounts.findFirst());
    }),
  );
  const view = await renderAccountPage();

  // Then the page shows it is loading
  await expect.element(view.loadingIndicator()).toBeVisible();
  await expect.element(view.loadingIndicator()).toHaveTextContent("Loading your account...");

  // Given the account arrives
  releaseAccount();

  // Then the heading, the edit link, and every stored field are shown - the
  // phone in national format, the language as its label rather than the
  // stored code - each value paired with its own term
  await expect.element(view.heading()).toBeVisible();
  await expect.element(view.summaryValue("Name")).toHaveTextContent(account.nom);
  await expect.element(view.summaryValue("First name")).toHaveTextContent(account.prenom);
  await expect.element(view.summaryValue("Email")).toHaveTextContent(account.email);
  await expect.element(view.summaryValue("Phone")).toHaveTextContent(phone.national);
  await expect
    .element(view.summaryValue("Language"))
    .toHaveTextContent(LANGUAGE_LABELS[account.langue]);
  await expect.element(view.summaryValue("Bio")).toHaveTextContent(account.bio);
  await expect.element(view.editLink()).toBeVisible();

  // Then the loading state is gone
  await expect.element(view.loadingIndicator()).not.toBeInTheDocument();
});

// Use case: Reading your account — Happy path
it("follows the edit link from the summary to the edit form", async () => {
  // Given a loaded summary
  await seedAccount();
  const view = await renderAccountPage();
  await expect.element(view.heading()).toBeVisible();

  // When the visitor follows the edit link
  await view.followEditLink();

  // Then they leave the summary behind and land on the form
  await expect.element(view.heading()).not.toBeInTheDocument();
  await expect.element(view.editFormHeading()).toBeVisible();
});

// Use case: Reading your account — Edge case
it('shows "Not provided" for a missing phone and an empty bio, and every other field as stored', async () => {
  // Given an account with no phone and an empty bio
  const account = await seedAccount({ telephone: null, bio: "" });
  const view = await renderAccountPage();

  // Then the phone and the bio fall back to the placeholder text
  await expect.element(view.summaryValue("Phone")).toHaveTextContent("Not provided");
  await expect.element(view.summaryValue("Bio")).toHaveTextContent("Not provided");

  // And every other field still shows what is stored
  await expect.element(view.summaryValue("Name")).toHaveTextContent(account.nom);
  await expect.element(view.summaryValue("First name")).toHaveTextContent(account.prenom);
  await expect.element(view.summaryValue("Email")).toHaveTextContent(account.email);
  await expect
    .element(view.summaryValue("Language"))
    .toHaveTextContent(LANGUAGE_LABELS[account.langue]);
});

// Use case: Reading your account — Edge case
it("shows an error and no summary when the account fails to load", async () => {
  // Given a server that fails the load
  worker.use(http.get(ACCOUNT_URL, () => new HttpResponse(null, { status: 500 })));

  // When the visitor lands on the summary
  const view = await renderAccountPage();

  // Then they see the error, and no summary
  await expect.element(view.errorBanner()).toBeVisible();
  await expect
    .element(view.errorBanner())
    .toHaveTextContent("Could not load your account. Please try again.");
  await expect.element(view.heading()).not.toBeInTheDocument();
});
