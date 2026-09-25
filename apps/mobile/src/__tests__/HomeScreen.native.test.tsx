/**
 * Integration coverage for the home tab - the mobile twin of
 * apps/home/src/__tests__/HomePage.integration.test.tsx.
 *
 * The screen has no data of its own; what is worth covering is the preview it
 * borrows, and the three things it can say.
 */
import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import { ACCOUNT_URL } from "@demo/account-core/mocks/handlers";
import { seedAccount } from "@demo/account-core/mocks/db-utils";
import { server } from "../test-server";

/** The setup function for this file. Apply AHA Testing principle. */
function renderHomeScreen() {
  renderRouter("src/app", { initialUrl: "/" });

  return {
    heading: () => screen.getByText("Welcome"),
    preview: () => screen.getByTestId("account-preview"),
    callToAction: () => screen.getByText("Go to your account"),
  };
}

// Use case: Landing on the app — Default render
it("welcomes the visitor and shows whose account this is", async () => {
  // Given a stored account
  const account = await seedAccount({});

  const view = renderHomeScreen();

  // Then the welcome is on screen from the first frame
  expect(view.heading()).toBeTruthy();
  expect(view.callToAction()).toBeTruthy();

  // And the preview names the account holder once it has loaded
  await waitFor(() => expect(view.preview()).toBeTruthy());
  expect(view.preview()).toHaveTextContent(
    `Your account: ${account.prenom} ${account.nom} (${account.email})`,
  );
});

// Use case: Landing on the app — The account cannot be loaded
it("keeps the welcome when the account behind the preview cannot be loaded", async () => {
  // Given an API that fails
  server.use(http.get(ACCOUNT_URL, () => new HttpResponse(null, { status: 500 })));

  const view = renderHomeScreen();

  // Then only the preview is lost - the page around it stands
  await waitFor(() => expect(screen.getByText("Could not load your account.")).toBeTruthy());
  expect(view.heading()).toBeTruthy();
  expect(view.callToAction()).toBeTruthy();
});
