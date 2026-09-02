---
title: Substitute the Network, Not the Module That Calls It
impact: HIGH
impactDescription: the request the app builds is exercised, not skipped
tags: seam, msw, vi.mock
---

## Substitute the Network, Not the Module That Calls It

Mocking `helpers/api.ts` proves the page calls a function; it says nothing about the URL, the method, the body, the parsing or the error path the real function runs. An msw handler on the endpoint lets all of that execute and answers only the wire.

**Incorrect (the API module replaced; the request is never built):**

```tsx
vi.mock("../helpers/api", () => ({
  fetchAccount: vi.fn().mockResolvedValue({ nom: "Ada", prenom: "Lovelace" }),
}));

it("shows the account", async () => {
  renderRoute("/account");
  expect(await screen.findByText("Ada")).toBeVisible();
});
```

**Correct (the shared handler answers over the seeded store):**

```tsx
it("shows the account", async () => {
  // Given a stored account — mocks/handlers.ts already serves GET /api/account
  const account = await seedAccount();
  const page = renderAccountPage();

  // Then the summary shows it
  expect(await page.summaryValue("Name")).toHaveTextContent(account.nom);
});
```

**Correct (the journey's own answer, when the shared one is not what it needs):**

```tsx
server.use(
  http.get(ACCOUNT_URL, () => HttpResponse.json({ message: "nope" }, { status: 500 })),
);
```

The endpoint constant lives beside the handler — `ACCOUNT_URL` in `mocks/handlers.ts` — so a test and the shared set name the same path.
