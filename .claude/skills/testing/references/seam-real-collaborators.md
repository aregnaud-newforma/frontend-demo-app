---
title: Hooks, Children, Stores and Helpers Run for Real
impact: HIGH
impactDescription: the journey proves the wiring, not a stand-in
tags: seam, vi.mock, hooks, components
---

## Hooks, Children, Stores and Helpers Run for Real

A mocked child renders whatever the mock says; a mocked hook returns whatever the test wants. Either way the page under test is wired to something the user never sees, and the test passes while the real wiring is broken. The handler feeds the real hook, which feeds the real component.

**Incorrect (the hook and a child stubbed out):**

```tsx
vi.mock("../hooks/use-account", () => ({
  useAccount: () => ({ data: { nom: "Ada" }, isLoading: false }),
}));
vi.mock("../components/SummaryRow", () => ({
  SummaryRow: ({ value }: { value: string }) => <span>{value}</span>,
}));
```

**Correct (nothing mocked; the store and handler drive the real tree):**

```tsx
it("shows a loading state, then every field under its own term", async () => {
  // Given a stored account, with its GET held open
  const account = await seedAccount();
  const { promise: accountArrives, resolve: releaseAccount } = deferred();
  server.use(
    http.get(ACCOUNT_URL, async () => {
      await accountArrives;
      return HttpResponse.json(accounts.findFirst());
    }),
  );
  const page = renderAccountPage();

  // Then the page shows it is loading
  expect(await page.loadingIndicator()).toBeVisible();

  // Given the account arrives
  releaseAccount();

  // Then the real hook fed the real rows
  expect(await page.summaryValue("Name")).toHaveTextContent(account.nom);
});
```

The one `vi.fn()` an integration test keeps is the **callback prop** of a component mounted alone through `renderComponent` — that is the collaborator its contract hands back, not a stand-in for one.
