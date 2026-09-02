---
title: Build Records With the Factory, Never by Hand
impact: MEDIUM
impactDescription: one definition of valid; a schema change is a one-file edit
tags: fixtures, fishery, faker, factory
---

## Build Records With the Factory, Never by Hand

A record written out in a test goes stale the day the schema gains a field, and every test carrying one breaks at once. The vertical's Fishery factory in `mocks/db-utils.ts` is the one place that knows what a valid record is; `seedAccount()` builds one and puts it in the store in the same call.

**Incorrect (a literal record, valid today):**

```tsx
await accounts.create({
  id: "1",
  nom: "Lovelace",
  prenom: "Ada",
  email: "ada@example.com",
  telephone: "+33612345678",
  langue: "en",
  bio: "Mathematician",
});
```

**Correct (the factory builds it, the seed stores it):**

```tsx
const account = await seedAccount();
```

**Correct (form values for what the user types, from the values factory):**

```tsx
const edited = accountValuesFactory.build();
await form.changeName(edited.nom);
```

A shape the vertical has no factory for yet gets one beside the others — `Factory.define<T>(() => ({ ... }))`, faker for every field, exported as `<name>Factory`.
