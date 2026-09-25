/**
 * Integration coverage for the account tab - the screen a visitor lands on at
 * /account, and the mobile twin of
 * apps/account/src/__tests__/AccountPage.integration.test.tsx.
 *
 * Mounted through `renderRouter`, which builds the real route tree from the
 * files in src/app and starts it at one path - the same argument
 * packages/testing/src/render-route.tsx makes for the web: a screen that
 * navigates cannot be tested apart from the tree it navigates within.
 */
import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import { accounts } from "@demo/account-core/mocks/db";
import { ACCOUNT_URL } from "@demo/account-core/mocks/handlers";
import { createFrenchPhone, seedAccount } from "@demo/account-core/mocks/db-utils";
import { LANGUAGE_LABELS } from "@demo/account-core/validation";
import { server } from "../test-server";

/** The setup function for this file. Apply AHA Testing principle. */
function renderAccountScreen() {
  renderRouter("src/app", { initialUrl: "/account" });

  return {
    heading: () => screen.getByText("Your account"),
    loadingIndicator: () => screen.getByTestId("account-loading"),
    errorBanner: () => screen.getByTestId("account-error"),
    editLink: () => screen.getByTestId("edit-account-link"),
    /** One field's value, found by the term it is paired with. */
    summaryValue: (term: string) =>
      screen.getByTestId(`summary-value-${term.toLowerCase().replaceAll(/\s+/g, "-")}`),
  };
}

// Use case: Reading your account — Default render
it("shows every stored field once the account arrives", async () => {
  // Given a stored account
  const phone = createFrenchPhone();
  const account = await seedAccount({ telephone: phone.e164 });

  // When the account screen is opened
  const view = renderAccountScreen();

  // Then every field is on screen, each under its own term
  await waitFor(() => expect(view.summaryValue("Name")).toHaveTextContent(account.nom));
  expect(view.summaryValue("First name")).toHaveTextContent(account.prenom);
  expect(view.summaryValue("Email")).toHaveTextContent(account.email);
  // The stored E.164 number, shown in the national form a person reads
  expect(view.summaryValue("Phone")).toHaveTextContent(phone.national);
  expect(view.summaryValue("Language")).toHaveTextContent(LANGUAGE_LABELS[account.langue]);
  expect(view.summaryValue("Bio")).toHaveTextContent(account.bio);
});

// Use case: Reading your account — Empty optional fields
it("says so rather than leaving a blank where an optional field is empty", async () => {
  // Given an account with neither a phone nor a bio
  await seedAccount({ telephone: null, bio: "" });

  const view = renderAccountScreen();

  // Then both optional fields say they were not provided
  await waitFor(() => expect(view.summaryValue("Phone")).toHaveTextContent("Not provided"));
  expect(view.summaryValue("Bio")).toHaveTextContent("Not provided");
});

// Use case: Reading your account — The account cannot be loaded
it("offers to try again when the account cannot be loaded", async () => {
  // Given an API that fails
  server.use(http.get(ACCOUNT_URL, () => new HttpResponse(null, { status: 500 })));

  const view = renderAccountScreen();

  // Then the failure is announced, and no summary is shown
  await waitFor(() =>
    expect(view.errorBanner()).toHaveTextContent("Could not load your account. Please try again."),
  );
  expect(screen.queryByTestId("account-summary")).toBeNull();
  expect(accounts.findFirst()).toBeUndefined();
});
