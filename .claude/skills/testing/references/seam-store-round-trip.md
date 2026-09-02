---
title: A Save Is Proved on What the Store Holds
impact: HIGH
impactDescription: proves the payload, not just the click
tags: seam, msw, @msw/data, store, mutation
---

## A Save Is Proved on What the Store Holds

A journey that writes and reads back needs a backend that remembers. The `@msw/data` collection in `mocks/db.ts` is that backend: the shared PUT handler writes into it, the GET reads out of it, and the test ends on `accounts.findFirst()` — the edit persisted in the shape the server stores, or nothing sent at all.

**Incorrect (the handler is a spy; the payload's shape is never checked):**

```tsx
const put = vi.fn(() => HttpResponse.json({}));
server.use(http.put(ACCOUNT_URL, put));
await form.saveForm();
expect(put).toHaveBeenCalled();
```

**Correct (the store proves what was sent, and the summary proves what came back):**

```tsx
// When the user enters a phone and saves — the shared PUT writes the store
const phone = createFrenchPhone();
await form.changePhone(phone.formatted);
await form.saveForm();

// Then the summary shows it in national format
expect(await form.summaryValue("Phone")).toHaveTextContent(phone.national);

// And the store holds it in E.164
expect(accounts.findFirst()).toMatchObject({ telephone: phone.e164 });
```

**Correct (nothing sent, proved the same way):**

```tsx
await form.changeEmail("not-an-email");
await form.saveForm();
expect(await form.fieldError("Email is invalid")).toBeVisible();
expect(accounts.findFirst()).toMatchObject({ email: account.email });
```
