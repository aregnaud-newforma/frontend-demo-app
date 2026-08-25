/**
 * E2E TEST (Playwright) - best practices
 * - Cover the HAPPY PATH only at this level. E2E is slow and expensive; it exists
 *   to prove the whole flow wires together, not to enumerate edge cases (those
 *   live in the integration and unit tests).
 */
import { test, expect, type Page } from "@playwright/test";
import { accountFactory, createFrenchPhone } from "@account/mocks/db-utils";
import { LANGUAGE_LABELS } from "@account/helpers/validation";
import { startSession } from "./session";

/**
 * The <dd> holding one term's value on the summary, e.g. summaryValue(page,
 * "Email"). Pairing the value with its term is what makes "every field" a real
 * check: a bare getByText would still pass if the app rendered the right values
 * under the wrong labels, or dropped a row entirely.
 */

const summaryValue = (page: Page, term: string) =>
  page
    .locator("dt", { hasText: new RegExp(`^${term}$`) })
    .locator("xpath=following-sibling::dd[1]");

// Use case: Reading your account, Editing your account — Happy path
test("visitor navigates to their account, edits every field and is returned to the summary", async ({
  page,
  request,
}) => {
  // Given an account stored in the real API, in a session of this test's own so
  // the specs running beside it cannot touch it.
  const phone = createFrenchPhone();
  const account = accountFactory.build({ telephone: phone.e164 });
  await startSession(page, request, account);

  const editedPhone = createFrenchPhone();
  const edited = accountFactory.build({
    langue: account.langue === "fr" ? "en" : "fr",
    telephone: editedPhone.e164,
  });

  // When the visitor lands on the root
  await page.goto("/");

  // Then they are welcomed. Nothing is fetched for this page, so arriving here
  // proves the app booted and routed before any API call is in play - which is
  // what makes a failure in the next step unambiguous.
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();

  // When they follow the account link in the nav. Scoped to the landmark: the
  // welcome links to the account too, and role-name matching is a substring
  // match, so unscoped this would be ambiguous.
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Your account" })
    .click();

  // Then they are on the summary, the GET landed, and every stored field is
  // rendered under its own term.
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  await expect(summaryValue(page, "Name")).toHaveText(account.nom);
  await expect(summaryValue(page, "First name")).toHaveText(account.prenom);
  await expect(summaryValue(page, "Email")).toHaveText(account.email);
  // Stored in E.164, displayed the way a French user writes it.
  await expect(summaryValue(page, "Phone")).toHaveText(phone.national);
  // The stored code ("fr") is never shown to a user; the label is.
  await expect(summaryValue(page, "Language")).toHaveText(LANGUAGE_LABELS[account.langue]);
  await expect(summaryValue(page, "Bio")).toHaveText(account.bio);

  // When they follow the edit link
  await page.getByRole("link", { name: "Edit your account" }).click();

  // Then every input is seeded with the stored value.
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(account.nom);
  await expect(page.getByLabel("First name")).toHaveValue(account.prenom);
  await expect(page.getByLabel("Email")).toHaveValue(account.email);
  await expect(page.getByLabel("Phone (optional)")).toHaveValue(phone.national);
  await expect(page.getByLabel("Language")).toHaveValue(account.langue);
  await expect(page.getByLabel("Bio (optional)")).toHaveValue(account.bio);

  // When they change every input and save.
  await page.getByLabel("Name", { exact: true }).fill(edited.nom);
  await page.getByLabel("First name").fill(edited.prenom);
  await page.getByLabel("Email").fill(edited.email);
  await page.getByLabel("Phone (optional)").fill(editedPhone.formatted);
  await page.getByLabel("Language").selectOption(edited.langue);
  await page.getByLabel("Bio (optional)").fill(edited.bio);
  await page.getByRole("button", { name: "Save", exact: true }).click();

  // Then they are back on the summary, and every field shows the new value.
  await expect(page).toHaveURL(/\/account$/);
  await expect(summaryValue(page, "Name")).toHaveText(edited.nom);
  await expect(summaryValue(page, "First name")).toHaveText(edited.prenom);
  await expect(summaryValue(page, "Email")).toHaveText(edited.email);
  await expect(summaryValue(page, "Phone")).toHaveText(editedPhone.national);
  await expect(summaryValue(page, "Language")).toHaveText(LANGUAGE_LABELS[edited.langue]);
  await expect(summaryValue(page, "Bio")).toHaveText(edited.bio);
});
