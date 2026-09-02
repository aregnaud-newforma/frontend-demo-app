---
title: Hold the Answer to Assert an In-Flight State
impact: HIGH
impactDescription: the assertion lands where the test puts it, never on a timer
tags: seam, msw, deferred, loading, delay
---

## Hold the Answer to Assert an In-Flight State

A spinner, a disabled "Saving..." button, a skeleton row exist only while the request is open. `delay()` and a fake clock **time** the answer, so the assertion races a duration nobody controls — green on a fast machine, red in CI. `deferred()` from `@testing/deferred` **places** it: the handler awaits a promise, the test resolves it on the line where the answer should land.

**Incorrect (the answer is timed, the assertion races it):**

```tsx
server.use(
  http.put(ACCOUNT_URL, async () => {
    await delay(200);
    return HttpResponse.json(accounts.findFirst());
  }),
);
await form.saveForm();
expect(await form.savingButton()).toBeDisabled(); // may already be gone
```

**Correct (the answer is held, then released):**

```tsx
// When the user saves, with the save held open
const { promise: saveArrives, resolve: releaseSave } = deferred();
server.use(
  http.put(ACCOUNT_URL, async () => {
    await saveArrives;
    return HttpResponse.json(accounts.findFirst());
  }),
);
await form.saveForm();

// Then Save is disabled and relabelled while the save is in flight
expect(await form.savingButton()).toBeDisabled();

// Given the save resolves
releaseSave();

// Then the visitor lands on the summary
expect(await form.accountHeading()).toBeVisible();
```

The same holds for a page's arrival: hold the GET, assert the loading state, release, assert what loaded.
