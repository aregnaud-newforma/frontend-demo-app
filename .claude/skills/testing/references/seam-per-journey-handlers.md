---
title: A Journey's Own Answer Goes in Its Body, Not in the Shared Set
impact: HIGH
impactDescription: keeps the shared handlers a happy path every test can start from
tags: seam, msw, handlers, server.use
---

## A Journey's Own Answer Goes in Its Body, Not in the Shared Set

`mocks/handlers.ts` is the answer every journey can live with. A refusal, a held reply or a special fixture belongs to the one test that turns it on: `server.use(...)` in that test's body wins over the shared set and is dropped by the `afterEach` reset. Editing the shared set to serve one test — a flag, a counter, a special-cased email — leaks that case into every other test.

**Incorrect (the shared handler grows a switch for one test):**

```ts
// mocks/handlers.ts
let failNextPut = false;
export const failNext = () => { failNextPut = true; };

http.put(ACCOUNT_URL, async ({ request }) => {
  if (failNextPut) { failNextPut = false; return new HttpResponse(null, { status: 500 }); }
  ...
});
```

**Correct (the refusal lives in the test that needs it):**

```tsx
// Use case: Editing your account — Edge case
it("keeps the form and shows the error when the save is refused", async () => {
  // Given a loaded form, and a server that will refuse the save
  await seedAccount();
  const form = renderEditAccountPage();
  expect(await form.emailInput()).toBeVisible();
  server.use(
    http.put(ACCOUNT_URL, () => HttpResponse.json({ message: "nope" }, { status: 500 })),
  );

  // When the user saves
  await form.saveForm();

  // Then the error is shown and the form is still there
  expect(await form.errorBanner()).toBeVisible();
  expect(form.saveButton()).toBeEnabled();
});
```

Use a leading `*` in the path only where the app resolves a host at runtime; this app requests `/api/...` relative to the page origin, so the shared `ACCOUNT_URL` is the whole pattern.
