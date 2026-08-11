/**
 * Integration coverage for the account summary, driven through test ids so the
 * selectors stay stable when the copy or the markup changes.
 */
import { http, HttpResponse, delay } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { worker } from "@testing/worker";
import { renderRoute } from "@testing/render-route";
import { accounts } from "../mocks/db";
import { ACCOUNT_URL } from "../mocks/handlers";
import { createFrenchPhone, seedAccount } from "../mocks/db-utils";
import { LANGUAGE_LABELS } from "../helpers/validation";
import type { Account } from "../helpers/api";

let account: Account;
let phone: ReturnType<typeof createFrenchPhone>;

beforeEach(async () => {
  phone = createFrenchPhone();
  account = await seedAccount({ telephone: phone.e164 });
});

describe("AccountPage (test ids)", () => {
  describe("structure", () => {
    it("renders the heading", async () => {
      const screen = await renderRoute("/account");
      await expect.element(screen.getByTestId("account-heading")).toBeVisible();
    });

    it("renders the heading copy", async () => {
      const screen = await renderRoute("/account");
      await expect.element(screen.getByTestId("account-heading")).toHaveTextContent("Your account");
    });

    it("renders the summary container", async () => {
      const screen = await renderRoute("/account");
      await expect.element(screen.getByTestId("account-summary")).toBeVisible();
    });

    it("renders the edit link", async () => {
      const screen = await renderRoute("/account");
      await expect.element(screen.getByTestId("edit-account-link")).toBeVisible();
    });

    it("renders the edit link copy", async () => {
      const screen = await renderRoute("/account");
      await expect
        .element(screen.getByTestId("edit-account-link"))
        .toHaveTextContent("Edit your account");
    });
  });

  describe("summary terms", () => {
    it("renders the name term", async () => {
      const screen = await renderRoute("/account");
      await expect.element(screen.getByTestId("summary-term-name")).toHaveTextContent("Name");
    });

    it("renders the first name term", async () => {
      const screen = await renderRoute("/account");
      await expect
        .element(screen.getByTestId("summary-term-first-name"))
        .toHaveTextContent("First name");
    });

    it("renders the email term", async () => {
      const screen = await renderRoute("/account");
      await expect.element(screen.getByTestId("summary-term-email")).toHaveTextContent("Email");
    });

    it("renders the phone term", async () => {
      const screen = await renderRoute("/account");
      await expect.element(screen.getByTestId("summary-term-phone")).toHaveTextContent("Phone");
    });

    it("renders the language term", async () => {
      const screen = await renderRoute("/account");
      await expect
        .element(screen.getByTestId("summary-term-language"))
        .toHaveTextContent("Language");
    });

    it("renders the bio term", async () => {
      const screen = await renderRoute("/account");
      await expect.element(screen.getByTestId("summary-term-bio")).toHaveTextContent("Bio");
    });
  });

  describe("summary values", () => {
    it("renders the name value", async () => {
      const screen = await renderRoute("/account");
      await expect.element(screen.getByTestId("summary-value-name")).toHaveTextContent(account.nom);
    });

    it("renders the first name value", async () => {
      const screen = await renderRoute("/account");
      await expect
        .element(screen.getByTestId("summary-value-first-name"))
        .toHaveTextContent(account.prenom);
    });

    it("renders the email value", async () => {
      const screen = await renderRoute("/account");
      await expect
        .element(screen.getByTestId("summary-value-email"))
        .toHaveTextContent(account.email);
    });

    it("renders the phone value", async () => {
      const screen = await renderRoute("/account");
      await expect
        .element(screen.getByTestId("summary-value-phone"))
        .toHaveTextContent(phone.national);
    });

    it("renders the language value", async () => {
      const screen = await renderRoute("/account");
      await expect
        .element(screen.getByTestId("summary-value-language"))
        .toHaveTextContent(LANGUAGE_LABELS[account.langue]);
    });

    it("renders the bio value", async () => {
      const screen = await renderRoute("/account");
      await expect.element(screen.getByTestId("summary-value-bio")).toHaveTextContent(account.bio);
    });

    it("renders the fallback in the phone value when there is no phone", async () => {
      accounts.clear();
      await seedAccount({ telephone: null });

      const screen = await renderRoute("/account");
      await expect
        .element(screen.getByTestId("summary-value-phone"))
        .toHaveTextContent("Not provided");
    });

    it("renders the fallback in the bio value when the bio is empty", async () => {
      accounts.clear();
      await seedAccount({ bio: "" });

      const screen = await renderRoute("/account");
      await expect
        .element(screen.getByTestId("summary-value-bio"))
        .toHaveTextContent("Not provided");
    });
  });

  describe("states", () => {
    it("renders the loading node while the account is in flight", async () => {
      worker.use(
        http.get(ACCOUNT_URL, async () => {
          await delay(300);
          return HttpResponse.json(accounts.findFirst());
        }),
      );

      const screen = await renderRoute("/account");
      await expect.element(screen.getByTestId("account-loading")).toBeVisible();
    });

    it("renders the loading copy while the account is in flight", async () => {
      worker.use(
        http.get(ACCOUNT_URL, async () => {
          await delay(300);
          return HttpResponse.json(accounts.findFirst());
        }),
      );

      const screen = await renderRoute("/account");
      await expect
        .element(screen.getByTestId("account-loading"))
        .toHaveTextContent("Loading your account...");
    });

    it("removes the loading node once the account arrives", async () => {
      const screen = await renderRoute("/account");
      await expect.element(screen.getByTestId("account-summary")).toBeVisible();
      await expect.element(screen.getByTestId("account-loading")).not.toBeInTheDocument();
    });

    it("renders the error node when the load fails", async () => {
      worker.use(http.get(ACCOUNT_URL, () => new HttpResponse(null, { status: 500 })));

      const screen = await renderRoute("/account");
      await expect.element(screen.getByTestId("account-error")).toBeVisible();
    });

    it("renders the error copy when the load fails", async () => {
      worker.use(http.get(ACCOUNT_URL, () => new HttpResponse(null, { status: 500 })));

      const screen = await renderRoute("/account");
      await expect
        .element(screen.getByTestId("account-error"))
        .toHaveTextContent("Could not load your account. Please try again.");
    });

    it("removes the summary when the load fails", async () => {
      worker.use(http.get(ACCOUNT_URL, () => new HttpResponse(null, { status: 500 })));

      const screen = await renderRoute("/account");
      await expect.element(screen.getByTestId("account-error")).toBeVisible();
      await expect.element(screen.getByTestId("account-summary")).not.toBeInTheDocument();
    });
  });

  describe("navigation", () => {
    it("moves to the edit form when the edit link is clicked", async () => {
      const screen = await renderRoute("/account");
      await screen.getByTestId("edit-account-link").click();
      await expect.element(screen.getByTestId("account-summary")).not.toBeInTheDocument();
    });
  });
});
