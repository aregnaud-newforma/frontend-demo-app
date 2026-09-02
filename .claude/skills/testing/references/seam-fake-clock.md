---
title: Fake the Clock, Keep the Module Real
impact: MEDIUM
impactDescription: a debounce or a timer runs its own code against a clock the test drives
tags: seam, timers, debounce, vi.useFakeTimers
---

## Fake the Clock, Keep the Module Real

A debounce, an animation or a `Date.now()` is not a seam to mock away; it is behaviour the user lives through. `vi.useFakeTimers()` puts the clock under the test's control and lets the real module run. It is the one thing that goes in a `beforeEach`: the clock is runner state, and it has to be faked before the mount in the body ever sees the real one.

Two libraries sit on that clock and neither knows Vitest faked it. `findBy*` and `waitFor` only advance **Jest's** fake timers on their own, so under Vitest they time out unless the clock is created with `shouldAdvanceTime: true`. `userEvent` waits between keystrokes with `setTimeout`, so it is given `advanceTimers: vi.advanceTimersByTime` or every `type` hangs.

**Incorrect (the debouncing module replaced so the test can skip it):**

```tsx
vi.mock("../helpers/debounce", () => ({ debounce: (fn: Function) => fn }));
```

**Correct (the clock faked, the module real, advanced where the journey waits):**

```tsx
beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

function renderEmailsPage() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderRoute("/emails");

  return {
    row: (subject: string) => screen.findByRole("row", { name: subject }),
    typeSearch: async (text: string) => user.type(await screen.findByRole("searchbox"), text),
  };
}

// Use case: Searching emails — Happy path
it("searches once the user pauses typing", async () => {
  // Given a loaded list
  const list = renderEmailsPage();

  // When the user types and pauses
  await list.typeSearch("invoice");
  await vi.advanceTimersByTimeAsync(300);

  // Then the matching rows are shown
  expect(await list.row("Invoice #12")).toBeVisible();
});
```

Fake timers time the **app's** waits. They never time a **server's** answer — that is [seam-held-answer.md](seam-held-answer.md).
