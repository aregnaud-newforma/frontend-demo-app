/**
 * Integration coverage for EditAccountPage - the form a visitor edits their
 * account through, at "/account/edit".
 */
import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { worker } from "@demo/testing/worker";
import { deferred } from "@demo/testing/deferred";
import { renderRoute } from "@demo/testing/render-route";
import { app } from "@demo/shell/app-under-test";
import { accounts } from "../mocks/db";
import { ACCOUNT_URL } from "../mocks/handlers";
import { accountValuesFactory, createFrenchPhone, seedAccount } from "../mocks/db-utils";
import { LANGUAGE_LABELS } from "../helpers/validation";
import type { AccountValues, Language } from "../helpers/validation";
import type { AccountPayload } from "../helpers/api";

/*
 * Integration: page
 */

/**
 * The setup function for this file. Apply AHA Testing principle.
 */
async function renderEditAccountPage() {
  const screen = await renderRoute("/account/edit", app);

  return {
    nameInput: () => screen.getByLabelText("Name", { exact: true }),
    firstNameInput: () => screen.getByLabelText("First name"),
    emailInput: () => screen.getByLabelText("Email"),
    phoneInput: () => screen.getByLabelText("Phone (optional)"),
    languageSelect: () => screen.getByLabelText("Language"),
    bioInput: () => screen.getByLabelText("Bio (optional)"),

    loadingIndicator: () => screen.getByRole("status"),
    errorBanner: () => screen.getByRole("alert"),
    saveButton: () => screen.getByRole("button", { name: "Save", exact: true }),
    savingButton: () => screen.getByRole("button", { name: "Saving...", exact: true }),
    cancelLink: () => screen.getByRole("link", { name: "Cancel" }),
    // exact: true - "Edit your account" is a substring match on "Your account"
    // otherwise, and the Happy path and Cancel journeys need this heading gone
    // once they leave the form.
    accountHeading: () => screen.getByRole("heading", { name: "Your account", exact: true }),
    /** One field's validation message, e.g. fieldError("Name is required"). */
    fieldError: (message: string) => screen.getByText(message, { exact: true }),
    /** One field's value on the summary, paired with its own term, e.g.
     *  summaryValue("Phone") - proving the pairing, not just that the text is
     *  somewhere on the page. */
    summaryValue: (term: string) => screen.getByRole("group", { name: term, exact: true }),

    changeName: (value: string) => screen.getByLabelText("Name", { exact: true }).fill(value),
    changeFirstName: (value: string) => screen.getByLabelText("First name").fill(value),
    changeEmail: (value: string) => screen.getByLabelText("Email").fill(value),
    changePhone: (value: string) => screen.getByLabelText("Phone (optional)").fill(value),
    changeLanguage: (value: AccountValues["langue"]) =>
      screen.getByLabelText("Language").selectOptions(value),
    changeBio: (value: string) => screen.getByLabelText("Bio (optional)").fill(value),

    saveForm: () => screen.getByRole("button", { name: "Save", exact: true }).click(),
    cancelEdit: () => screen.getByRole("link", { name: "Cancel" }).click(),
  };
}

// Use case: Editing your account — Default render
it("shows a loading state, then every field seeded from the stored account", async () => {
  // Given a stored account, with its GET held open
  const phone = createFrenchPhone();
  const account = await seedAccount({ telephone: phone.e164 });
  const { promise: accountArrives, resolve: releaseAccount } = deferred<void>();
  worker().use(
    http.get(ACCOUNT_URL, async () => {
      await accountArrives;
      return HttpResponse.json(accounts.findFirst());
    }),
  );
  const form = await renderEditAccountPage();

  // Then the page shows it is loading
  await expect.element(form.loadingIndicator()).toBeVisible();
  await expect.element(form.loadingIndicator()).toHaveTextContent("Loading your account...");

  // Given the account arrives
  releaseAccount();

  // Then every field is seeded from the stored account - the phone in
  // national format, and the language selected by its stored code
  await expect.element(form.nameInput()).toHaveValue(account.nom);
  await expect.element(form.firstNameInput()).toHaveValue(account.prenom);
  await expect.element(form.emailInput()).toHaveValue(account.email);
  await expect.element(form.phoneInput()).toHaveValue(phone.national);
  await expect.element(form.languageSelect()).toHaveValue(account.langue);
  await expect.element(form.bioInput()).toHaveValue(account.bio);

  // And the language select offers its placeholder beside French and English
  await expect.element(form.languageSelect()).toHaveTextContent("Choose a language");
  await expect.element(form.languageSelect()).toHaveTextContent("French");
  await expect.element(form.languageSelect()).toHaveTextContent("English");

  // And Save is enabled, with no field flagged
  await expect.element(form.saveButton()).toBeEnabled();
  await expect.element(form.nameInput()).not.toHaveAttribute("aria-invalid");
  await expect.element(form.firstNameInput()).not.toHaveAttribute("aria-invalid");
  await expect.element(form.emailInput()).not.toHaveAttribute("aria-invalid");
  await expect.element(form.phoneInput()).not.toHaveAttribute("aria-invalid");
  await expect.element(form.languageSelect()).not.toHaveAttribute("aria-invalid");
  await expect.element(form.bioInput()).not.toHaveAttribute("aria-invalid");

  // Then the loading state is gone
  await expect.element(form.loadingIndicator()).not.toBeInTheDocument();
});

// Use case: Editing your account — Happy path
it("edits every field of an account with no phone, saves, and lands on the summary showing every new value", async () => {
  // Given a loaded form for an account stored with no phone
  await seedAccount({ telephone: null });
  const form = await renderEditAccountPage();
  await expect.element(form.emailInput()).toBeVisible();

  // When the user edits every field and saves, with the save held open
  const edited = accountValuesFactory.build();
  const phone = createFrenchPhone();
  const { promise: saveArrives, resolve: releaseSave } = deferred<void>();
  worker().use(
    http.put(ACCOUNT_URL, async ({ request }) => {
      await saveArrives;
      const body = (await request.json()) as AccountPayload;
      const updated = await accounts.update(accounts.findFirst()!, {
        strict: true,
        data(draft) {
          draft.nom = body.nom;
          draft.prenom = body.prenom;
          draft.email = body.email;
          draft.telephone = body.telephone;
          draft.langue = body.langue;
          draft.bio = body.bio;
        },
      });
      return HttpResponse.json(updated);
    }),
  );
  await form.changeName(edited.nom);
  await form.changeFirstName(edited.prenom);
  await form.changeEmail(edited.email);
  await form.changePhone(phone.formatted);
  await form.changeLanguage(edited.langue);
  await form.changeBio(edited.bio);
  await form.saveForm();

  // Then Save is disabled and relabelled while the save is in flight
  await expect.element(form.savingButton()).toBeVisible();
  await expect.element(form.savingButton()).toBeDisabled();

  // Given the save resolves
  releaseSave();

  // Then the visitor lands on the summary, showing every new value - the
  // phone entered in national format, even though the account started with
  // none
  await expect.element(form.accountHeading()).toBeVisible();
  await expect.element(form.summaryValue("Name")).toHaveTextContent(edited.nom);
  await expect.element(form.summaryValue("First name")).toHaveTextContent(edited.prenom);
  await expect.element(form.summaryValue("Email")).toHaveTextContent(edited.email);
  await expect.element(form.summaryValue("Phone")).toHaveTextContent(phone.national);
  await expect
    .element(form.summaryValue("Language"))
    // accountValuesFactory always builds a real language, never the placeholder.
    .toHaveTextContent(LANGUAGE_LABELS[edited.langue as Language]);
  await expect.element(form.summaryValue("Bio")).toHaveTextContent(edited.bio);

  // And the store holds the phone in E.164
  expect(accounts.findFirst()).toMatchObject({ telephone: phone.e164 });
});

// Use case: Editing your account — Edge case
it("rejects the form when every field is invalid, flags each one, sends nothing, and clears a message the moment it is corrected", async () => {
  // Given a loaded form
  const account = await seedAccount();
  const form = await renderEditAccountPage();
  await expect.element(form.emailInput()).toBeVisible();

  // When the user clears the name, breaks the email, enters an invalid
  // phone, and puts the language back on its placeholder, then saves
  await form.changeName("");
  await form.changeEmail("not-an-email");
  await form.changePhone("06 12 34 56");
  await form.changeLanguage("");
  await form.saveForm();

  // Then each field is flagged with its own message, and points at it
  await expect.element(form.fieldError("Name is required")).toBeVisible();
  await expect.element(form.nameInput()).toHaveAttribute("aria-invalid", "true");
  await expect.element(form.nameInput()).toHaveAttribute("aria-describedby", "nom-error");

  await expect.element(form.fieldError("Email is invalid")).toBeVisible();
  await expect.element(form.emailInput()).toHaveAttribute("aria-invalid", "true");
  await expect.element(form.emailInput()).toHaveAttribute("aria-describedby", "email-error");

  await expect.element(form.fieldError("Phone number is invalid")).toBeVisible();
  await expect.element(form.phoneInput()).toHaveAttribute("aria-invalid", "true");
  await expect.element(form.phoneInput()).toHaveAttribute("aria-describedby", "telephone-error");

  await expect.element(form.fieldError("Language is required")).toBeVisible();
  await expect.element(form.languageSelect()).toHaveAttribute("aria-invalid", "true");
  await expect.element(form.languageSelect()).toHaveAttribute("aria-describedby", "langue-error");

  // And nothing was sent
  expect(accounts.findFirst()).toEqual(account);

  // When the user corrects the name alone, without saving again
  await form.changeName(account.nom);

  // Then its message clears live, on its own
  await expect.element(form.fieldError("Name is required")).not.toBeInTheDocument();
});

// Use case: Editing your account — Edge case
it("stays on the form and shows an error banner when the save fails, clearing it once the user edits again", async () => {
  // Given a loaded form and a server that refuses the save
  const account = await seedAccount();
  worker().use(http.put(ACCOUNT_URL, () => new HttpResponse(null, { status: 500 })));
  const form = await renderEditAccountPage();
  await expect.element(form.emailInput()).toBeVisible();

  // When the user rewrites the bio and saves
  await form.changeBio("Rewritten bio.");
  await form.saveForm();

  // Then they stay on the form and are told, with the edit intact
  await expect.element(form.errorBanner()).toHaveTextContent("Something went wrong");
  await expect.element(form.bioInput()).toHaveValue("Rewritten bio.");

  // And nothing was persisted
  expect(accounts.findFirst()).toMatchObject({ bio: account.bio });

  // When the user edits again
  await form.changeBio("Rewritten again.");

  // Then the banner is gone
  await expect.element(form.errorBanner()).not.toBeInTheDocument();
});

// Use case: Editing your account — Edge case
it("abandons the edit: Cancel returns to the summary leaving the stored account unchanged", async () => {
  // Given a loaded form
  const account = await seedAccount();
  const form = await renderEditAccountPage();
  await expect.element(form.emailInput()).toBeVisible();

  // When the user edits a field but leaves via Cancel instead of saving
  await form.changeBio("Abandoned edit.");
  await form.cancelEdit();

  // Then they land back on the summary, showing the stored value untouched
  await expect.element(form.accountHeading()).toBeVisible();
  await expect.element(form.summaryValue("Bio")).toHaveTextContent(account.bio);

  // And the store holds exactly what was there before
  expect(accounts.findFirst()).toEqual(account);
});

// Use case: Editing your account — Edge case
it("shows an error and no form fields when the account fails to load", async () => {
  // Given a server that fails the load
  worker().use(http.get(ACCOUNT_URL, () => new HttpResponse(null, { status: 500 })));

  // When the visitor opens the edit form
  const form = await renderEditAccountPage();

  // Then they see the error, and are given no form to fill in
  await expect.element(form.errorBanner()).toBeVisible();
  await expect
    .element(form.errorBanner())
    .toHaveTextContent("Could not load your account. Please try again.");
  await expect.element(form.emailInput()).not.toBeInTheDocument();
});
