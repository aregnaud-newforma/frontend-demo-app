/**
 * Integration coverage for the edit form - the mobile twin of
 * apps/account/src/__tests__/EditAccountPage.integration.test.tsx, and the one
 * place where the shared schema, the mutation and the cache write are exercised
 * together on this platform.
 *
 * Mounted at /account/edit through the real route tree, so the save that pops
 * back has a stack to pop to.
 */
import { screen, waitFor, fireEvent } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import { accounts } from "@demo/account-core/mocks/db";
import { createFrenchPhone, seedAccount } from "@demo/account-core/mocks/db-utils";
import { LANGUAGE_LABELS } from "@demo/account-core/validation";

/** The setup function for this file. Apply AHA Testing principle. */
function renderEditScreen() {
  renderRouter("src/app", { initialUrl: "/account/edit" });

  return {
    field: (label: string) => screen.getByLabelText(label),
    saveButton: () => screen.getByTestId("save-account"),
    errorFor: (name: string) => screen.getByTestId(`field-error-${name}`),
    save: () => fireEvent.press(screen.getByTestId("save-account")),
    type: (label: string, value: string) =>
      fireEvent.changeText(screen.getByLabelText(label), value),
    chooseLanguage: (language: "fr" | "en") =>
      fireEvent.press(screen.getByLabelText(LANGUAGE_LABELS[language])),
  };
}

// Use case: Editing your account — Default render
it("opens on the stored values, with the phone in the form the user typed it", async () => {
  // Given a stored account whose phone is held in E.164
  const phone = createFrenchPhone();
  const account = await seedAccount({ telephone: phone.e164 });

  const view = renderEditScreen();

  // Then each control holds its stored value, the phone converted back
  await waitFor(() => expect(view.field("Name").props.value).toBe(account.nom));
  expect(view.field("Email").props.value).toBe(account.email);
  expect(view.field("Phone (optional)").props.value).toBe(phone.national);
});

// Use case: Editing your account — An invalid field
it("refuses to save an invalid phone number, and says which field is wrong", async () => {
  // Given a stored account
  const account = await seedAccount({});
  const view = renderEditScreen();
  await waitFor(() => expect(view.field("Name").props.value).toBe(account.nom));

  // When the phone is not a French number and the form is submitted
  view.type("Phone (optional)", "12");
  view.save();

  // Then the field is flagged and nothing was written
  await waitFor(() =>
    expect(view.errorFor("telephone")).toHaveTextContent("Phone number is invalid"),
  );
  expect(accounts.findFirst()?.telephone).toBe(account.telephone);
});

// Use case: Editing your account — Happy path
it("saves every edited field and returns to the summary", async () => {
  // Given a stored account, in French
  const account = await seedAccount({ langue: "fr" });
  const editedPhone = createFrenchPhone();
  const view = renderEditScreen();
  await waitFor(() => expect(view.field("Name").props.value).toBe(account.nom));

  // When every field is changed and the form is saved
  view.type("Name", "Martin");
  view.type("First name", "Camille");
  view.type("Email", "camille.martin@example.com");
  // Typed the way a person writes it, in pairs
  view.type("Phone (optional)", editedPhone.formatted);
  view.chooseLanguage("en");
  view.type("Bio (optional)", "Ships on Fridays.");
  view.save();

  // Then the store holds the new values, the phone normalized to E.164
  await waitFor(() => expect(accounts.findFirst()?.nom).toBe("Martin"));
  const saved = accounts.findFirst();
  expect(saved?.prenom).toBe("Camille");
  expect(saved?.email).toBe("camille.martin@example.com");
  expect(saved?.telephone).toBe(editedPhone.e164);
  expect(saved?.langue).toBe("en");
  expect(saved?.bio).toBe("Ships on Fridays.");

  // And the form is gone: the save popped back to the summary
  await waitFor(() => expect(screen.queryByTestId("save-account")).toBeNull());
});
