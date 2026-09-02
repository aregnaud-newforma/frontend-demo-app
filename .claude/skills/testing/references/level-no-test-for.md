---
title: Skip the Test That Proves Nothing the Code Could Lose
impact: MEDIUM
impactDescription: keeps the suite to behaviour that can regress
tags: levels, scope, drop
---

## Skip the Test That Proves Nothing the Code Could Lose

A test earns its place when the code could plausibly stop doing what it asserts and no static check would notice. Each example below passes green and protects nothing.

**Incorrect (the type system already holds it):**

```ts
it("returns an account with an id", async () => {
  const account = await fetchAccount();
  expect(account).toHaveProperty("id"); // Account.id is a required string
});
```

**Incorrect (the library's behaviour, not this repo's):**

```ts
it("useQuery exposes isLoading before data arrives", () => { ... });
```

**Correct (the behaviour a user would lose, asserted where it lives):**

```tsx
it("rejects an invalid email, flags the field, and sends nothing", async () => {
  // Given a loaded form
  await seedAccount();
  const form = renderEditAccountPage();
  expect(await form.emailInput()).toBeVisible();

  // When the user breaks the email and saves
  await form.changeEmail("not-an-email");
  await form.saveForm();

  // Then the field is flagged, and the store is untouched
  expect(await form.emailInput()).toHaveAttribute("aria-invalid", "true");
  expect(accounts.findFirst()?.email).not.toBe("not-an-email");
});
```

The heading a page shows is still asserted — as the **landmark** the journey arrives on (`getByRole("heading", { name: "Your account" })`), because arriving is behaviour. A paragraph of copy is not.
