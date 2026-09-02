---
title: Override Only the Field the Case Turns On
impact: MEDIUM
impactDescription: the override says what the test is about; the rest stays random
tags: fixtures, overrides, randomized
---

## Override Only the Field the Case Turns On

Random-but-valid values surface an accidental dependency on a specific string, and an override names the one thing the case is about. Pinning every field hides which one matters and reintroduces the literal the factory exists to remove.

**Incorrect (every field pinned; the missing phone is buried):**

```tsx
await seedAccount({
  nom: "Lovelace",
  prenom: "Ada",
  email: "ada@example.com",
  telephone: null,
  langue: "en",
  bio: "",
});
```

**Correct (the one field the journey turns on):**

```tsx
// Given a loaded form for an account stored with no phone
await seedAccount({ telephone: null });
```

A flag that **selects behaviour** — `hasAttachments`, `status` — is fixed in the factory's defaults and overridden explicitly by the test that branches on it; a field that **carries data** stays random.
