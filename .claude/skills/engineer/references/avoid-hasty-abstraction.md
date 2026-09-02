---
title: Avoid Hasty Abstraction
impact: HIGH
impactDescription: the wrong abstraction costs more to unwind than the duplication it replaced
tags: abstraction, duplication, refactoring
---

## Avoid Hasty Abstraction

Aim for the middle of the abstraction spectrum. Both extremes hurt maintainability.

- **ANA (Absolutely No Abstraction):** left extreme, where every piece of code is duplicated (copy/paste).
- **DRY (Don't Repeat Yourself):** right extreme. Every piece of knowledge has a single, authoritative representation in the system.
- **AHA (Avoid Hasty Abstraction):** the target. Sit between the two.

Rules:

- **Prefer duplication over the wrong abstraction.** Duplicated code is fine until you are confident you understand its use cases.
- **Optimize for change first.** The code will evolve in ways you cannot predict, so keep it simple, flexible, and easy to adapt.
- **Abstract when it feels right, not on a schedule.** Do not be dogmatic. Do not be afraid to duplicate until the right abstraction becomes clear.

**Incorrect (two callers shared a shape once, so the helper grew a flag for each difference):**

```ts
function formatUser(user: User, withEmail: boolean, withRole: boolean) {
  const parts = [user.name];
  if (withEmail) parts.push(user.email);
  if (withRole) parts.push(user.role);
  return parts.join(" — ");
}

formatUser(user, true, false);
formatUser(user, false, true);
```

**Correct (duplicate until the shared use case is actually understood):**

```ts
const formatUserForInvite = (user: User) => `${user.name} — ${user.email}`;
const formatUserForAdminList = (user: User) => `${user.name} — ${user.role}`;
```
