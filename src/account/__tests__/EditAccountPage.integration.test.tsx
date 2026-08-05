/**
 * INTEGRATION TEST - best practices
 * - Cover the happy path of BOTH round trips (load, save) and the edges that
 *   matter for each: a failed load, validation, a failed save, the two
 *   in-flight states.
 */
import { http, HttpResponse, delay } from "msw";
import { expect, it, describe } from "vitest";
import { worker } from "@testing/worker";
import { accounts } from "../mocks/db";
import { ACCOUNT_URL } from "../mocks/handlers";
import { createAccountValues, createFrenchPhone, seedAccount } from "../mocks/db-utils";
import { renderRoute } from "@testing/render-route";
import type { AccountValues } from "../helpers/validation";

/**
 * The setup function for this file. Apply AHA Testing principle
 */
async function renderEditAccountPage() {
  const screen = await renderRoute("/account/edit");

  const nameInput = screen.getByLabelText("Name", { exact: true });
  const firstNameInput = screen.getByLabelText("First name");
  const emailInput = screen.getByLabelText("Email");
  const phoneInput = screen.getByLabelText("Phone (optional)");
  const languageSelect = screen.getByLabelText("Language");
  const bioInput = screen.getByLabelText("Bio (optional)");
  const saveButton = screen.getByRole("button", { name: "Save", exact: true });

  return {
    nameInput,
    firstNameInput,
    emailInput,
    phoneInput,
    languageSelect,
    bioInput,

    loadingIndicator: screen.getByRole("status"),
    errorBanner: screen.getByRole("alert"),
    savingButton: screen.getByRole("button", { name: "Saving..." }),
    accountHeading: screen.getByRole("heading", { name: "Your account" }),
    summaryValue: (value: string) => screen.getByText(value, { exact: true }),

    /** One field's validation message, e.g. fieldError("Name is required"). */
    fieldError: (message: string) => screen.getByText(message, { exact: true }),

    changeName: (value: string) => nameInput.fill(value),
    changeFirstName: (value: string) => firstNameInput.fill(value),
    changeEmail: (value: string) => emailInput.fill(value),
    changePhone: (value: string) => phoneInput.fill(value),
    changeLanguage: (value: AccountValues["langue"]) => languageSelect.selectOptions(value),
    changeBio: (value: string) => bioInput.fill(value),

    saveForm: () => saveButton.click(),
  };
}

describe("EditAccountPage", () => {
  it("loads the account and shows it in the form", async () => {
    // Given an account whose phone is seeded explicitly, because it is the one
    // field the server and the form disagree about on purpose: stored E.164,
    // displayed national.
    const phone = createFrenchPhone();
    const account = await seedAccount({ telephone: phone.e164 });

    // When the user opens the edit form
    const form = await renderEditAccountPage();

    // Then every field holds the stored value
    await expect.element(form.nameInput).toHaveValue(account.nom);
    await expect.element(form.firstNameInput).toHaveValue(account.prenom);
    await expect.element(form.emailInput).toHaveValue(account.email);
    await expect.element(form.phoneInput).toHaveValue(phone.national);
    await expect.element(form.languageSelect).toHaveValue(account.langue);
    await expect.element(form.bioInput).toHaveValue(account.bio);
  });

  it("shows a loading state until the account arrives", async () => {
    // Given a slow load
    await seedAccount();
    worker.use(
      http.get(ACCOUNT_URL, async () => {
        await delay(300);
        return HttpResponse.json(accounts.findFirst());
      }),
    );

    // When the user opens the edit form
    const form = await renderEditAccountPage();

    // Then they are told it is loading
    await expect.element(form.loadingIndicator).toHaveTextContent("Loading your account");

    // And it gives way to the real form once the request lands
    await expect.element(form.emailInput).toBeVisible();
  });

  it("shows an error and no form when the account cannot be loaded", async () => {
    // Given a server that fails the load
    worker.use(http.get(ACCOUNT_URL, () => new HttpResponse(null, { status: 500 })));

    // When the user opens the edit form
    const form = await renderEditAccountPage();

    // Then they are told, and are given no form to fill in
    await expect.element(form.errorBanner).toHaveTextContent("Could not load your account");
    await expect.element(form.emailInput).not.toBeInTheDocument();
  });

  it("saves an edited account and returns to the summary", async () => {
    // Given a loaded edit form
    const account = await seedAccount();
    const form = await renderEditAccountPage();

    // When the user changes the name and the phone, and saves. The rest keeps the loaded values, which is
    // itself part of the contract.
    const phone = createFrenchPhone();
    const edited = createAccountValues();
    await form.changeName(edited.nom);
    await form.changePhone(phone.formatted);
    await form.saveForm();

    // Then they are back on the summary, showing the saved name.
    await expect.element(form.accountHeading).toBeVisible();
    await expect.element(form.summaryValue(edited.nom)).toBeVisible();

    // And what actually reached the "server" is the edit applied, the phone
    // normalized to E.164, and the untouched fields preserved.
    expect(accounts.findFirst()).toMatchObject({
      id: account.id,
      nom: edited.nom,
      telephone: phone.e164,
      email: account.email,
      bio: account.bio,
    });
  });

  it("shows the phone in the national format on the page it returns to", async () => {
    // Given a loaded edit form for an account with no phone
    await seedAccount({ telephone: null });
    const form = await renderEditAccountPage();

    // When the user types a phone with spaces and saves
    const phone = createFrenchPhone();
    await form.changePhone(phone.formatted);
    await form.saveForm();

    // Then the summary shows it in the national format on arrival.
    await expect.element(form.accountHeading).toBeVisible();
    await expect.element(form.summaryValue(phone.national)).toBeVisible();
  });

  it("clears the failure banner once the user edits again", async () => {
    // Given a save that has already failed
    await seedAccount();
    worker.use(http.put(ACCOUNT_URL, () => new HttpResponse(null, { status: 500 })));
    const form = await renderEditAccountPage();
    await form.changeBio("Rewritten bio.");
    await form.saveForm();
    await expect.element(form.errorBanner).toHaveTextContent("Something went wrong");

    // When the user edits again
    await form.changeBio("Rewritten again.");

    // Then the banner is gone.
    await expect.element(form.errorBanner).not.toBeInTheDocument();
  });

  it("rejects the placeholder language option", async () => {
    // Given a loaded edit form
    await seedAccount();
    const form = await renderEditAccountPage();

    // When the user puts the language back to the placeholder and saves. The
    // <select> opens on "Choose a language", so "" is a value a user can put back
    await form.changeLanguage("");
    await form.saveForm();

    // Then the field is flagged
    await expect.element(form.fieldError("Language is required")).toBeVisible();
    await expect.element(form.languageSelect).toHaveAttribute("aria-invalid", "true");
  });

  it("shows validation errors and saves nothing when a required field is cleared", async () => {
    // Given a loaded edit form
    const account = await seedAccount();
    const form = await renderEditAccountPage();

    // When the user clears the name and saves
    await form.changeName("");
    await form.saveForm();

    // Then the field is flagged
    await expect.element(form.fieldError("Name is required")).toBeVisible();
    await expect.element(form.nameInput).toHaveAttribute("aria-invalid", "true");

    // And nothing was sent: the store still holds what was seeded.
    expect(accounts.findFirst()).toMatchObject({ nom: account.nom });
  });

  it("flags an invalid email", async () => {
    // Given a loaded edit form
    const account = await seedAccount();
    const form = await renderEditAccountPage();

    // When the user replaces the email with something invalid and saves.
    // Everything else keeps its loaded, valid value, so the email is provably
    // the only reason the save was rejected.
    await form.changeEmail("not-an-email");
    await form.saveForm();

    // Then the field is flagged
    await expect.element(form.fieldError("Email is invalid")).toBeVisible();
    await expect.element(form.emailInput).toHaveAttribute("aria-invalid", "true");

    // And nothing was sent
    expect(accounts.findFirst()).toMatchObject({ email: account.email });
  });

  it("stays put and shows an error banner when the save fails", async () => {
    // Given a loaded edit form and a server that fails the save
    const account = await seedAccount();
    worker.use(http.put(ACCOUNT_URL, () => new HttpResponse(null, { status: 500 })));
    const form = await renderEditAccountPage();

    // When the user rewrites the bio and saves
    await form.changeBio("Rewritten bio.");
    await form.saveForm();

    // Then they are told, and are still on the form with the edit intact.
    await expect.element(form.errorBanner).toHaveTextContent("Something went wrong");
    await expect.element(form.bioInput).toHaveValue("Rewritten bio.");

    // And nothing was persisted
    expect(accounts.findFirst()).toMatchObject({ bio: account.bio });
  });

  it("disables the button and shows a pending label while saving", async () => {
    // Given a loaded edit form and a slow save.
    await seedAccount();
    worker.use(
      http.put(ACCOUNT_URL, async () => {
        await delay(300);
        return HttpResponse.json(accounts.findFirst());
      }),
    );
    const form = await renderEditAccountPage();

    // When the user rewrites the bio and saves
    await form.changeBio("Rewritten bio.");
    await form.saveForm();

    // Then the button is disabled and relabelled mid-flight
    await expect.element(form.savingButton).toBeDisabled();

    // And it resolves into the navigation
    await expect.element(form.accountHeading).toBeVisible();
  });
});
