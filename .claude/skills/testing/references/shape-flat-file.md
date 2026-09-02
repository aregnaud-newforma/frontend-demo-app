---
title: Flat File, Inline Setup, One Journey per `it`
impact: MEDIUM-HIGH
impactDescription: no state survives from one test to the next, and each test reads alone
tags: shape, describe, beforeEach, isolation
---

## Flat File, Inline Setup, One Journey per `it`

A `describe` adds a layer with no distinction — one journey per test is already the grouping. A `beforeEach` shares the mount and the seed between tests, which is exactly the state a flaky suite is made of, and it takes the `Given` out of the test that reads it. Each `it` sits at the top level and calls the setup in its own body.

**Incorrect (shared mount, shared seed, nested blocks):**

```tsx
describe("EditAccountPage", () => {
  let form: ReturnType<typeof renderEditAccountPage>;

  beforeEach(async () => {
    await seedAccount();
    form = renderEditAccountPage();
  });

  describe("when saving", () => {
    it("disables the button", async () => { ... });
    it("navigates to the summary", async () => { ... });
  });
});
```

**Correct (flat, each test owning its Given):**

```tsx
it("saves and lands on the summary", async () => {
  // Given a loaded form
  await seedAccount();
  const form = renderEditAccountPage();
  expect(await form.emailInput()).toBeVisible();
  ...
});

it("keeps the form when the save is refused", async () => {
  // Given a loaded form, and a server that will refuse the save
  await seedAccount();
  const form = renderEditAccountPage();
  ...
});
```

A second setup — a different seed, a different route, a `cleanup()` mid-test — is a second `it`. The one `beforeEach` a file may hold is `vi.useFakeTimers()`, with `vi.useRealTimers()` in the matching `afterEach` — [seam-fake-clock.md](seam-fake-clock.md).
