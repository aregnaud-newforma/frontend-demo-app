---
title: "`findBy*` Waits for Arrival, `waitFor` Waits for the Rest; Nothing Sleeps"
impact: HIGH
impactDescription: a query that retries until the screen catches up, without a timer
tags: mount, assertions, waitFor, findBy, async, jsdom
---

## `findBy*` Waits for Arrival, `waitFor` Waits for the Rest; Nothing Sleeps

Testing Library ships exactly one retry mechanism, and the query decides who owns it:

- `getBy*` is synchronous. It throws at once and never retries.
- `findBy*` is `waitFor` wrapped around `getBy*`. It polls the DOM (MutationObserver plus interval) until the element is there or the timeout expires — 1000 ms and 50 ms by default. This is the tool for something that arrives later: after a fetch, after a navigation, after a debounce.
- `waitFor(callback)` retries the callback until it stops throwing. It is for what is **not** a query result: a disappearance, a mock that gets called, a store that settles.
- `waitForElementToBeRemoved` is the disappearance case, and reads better than `waitFor` around a `queryBy*`.

`setTimeout` and `sleep` bolt a fixed delay on top of a retry that already exists, and a `waitFor` around a `findBy*` nests one retry inside another. Both hide the real timing of the page and both go flaky first.

**Incorrect (a sleep, a retry inside a retry, or two assertions sharing one retry):**

```tsx
await new Promise((resolve) => setTimeout(resolve, 500));
expect(screen.getByRole("heading", { name: "Your account" })).toBeVisible();

await waitFor(() => screen.findByText(account.nom));

await waitFor(() => {
  expect(screen.getByText(account.nom)).toBeVisible();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
```

**Correct (the query itself waits, once):**

```tsx
// Then the visitor lands on the summary
expect(await screen.findByRole("heading", { name: "Your account" })).toBeVisible();
expect(screen.getByRole("group", { name: "Name" })).toHaveTextContent(account.nom);

// And the loading state is gone
await waitForElementToBeRemoved(() => screen.queryByRole("status"));
```

Three consequences.

One `findBy*` gates the arrival; everything on the same screen is then synchronous and `getBy*` is enough. A journey that needs the page **loaded** before acting awaits one arrival first — `await screen.findByLabelText("Name")` — rather than typing into a form that is still fetching.

One assertion per `waitFor`, and no side effect inside it: a click or a `userEvent.type` inside the callback runs again on every retry. These are the `prefer-find-by`, `no-wait-for-multiple-assertions` and `no-wait-for-side-effects` rules of `eslint-plugin-testing-library`, and the lint enforces them.

`waitFor` only advances fake timers when it detects Jest. Under `vi.useFakeTimers()` a `findBy*` times out unless the clock is configured with `shouldAdvanceTime: true` or advanced by hand — [seam-fake-clock.md](seam-fake-clock.md).

A `not` assertion is only as strong as its query: `queryBy*` throws on two matches, so an ambiguous name fails loud rather than passing on the wrong node, and the fix is scoping with `within` — [mount-exact-names.md](mount-exact-names.md).
