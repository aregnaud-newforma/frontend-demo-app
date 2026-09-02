---
title: Compose Capabilities Instead of Inheriting Them
impact: MEDIUM
impactDescription: a change in a base class can break every descendant that inherits it
tags: composition, inheritance, reuse
---

## Compose Capabilities Instead of Inheriting Them

Deep inheritance spreads behaviour across every ancestor and every descendant that a change might break. Compose instead.

**Incorrect (to change admin behaviour you must trace Base -> Guest -> User -> Admin):**

```ts
class Base {
  save() {}
}
class GuestController extends Base {
  canRead() {
    return true;
  }
}
class UserController extends GuestController {
  canWrite() {
    return true;
  }
}
class AdminController extends UserController {
  canDelete() {
    return true;
  }
}
```

**Correct (compose only the capabilities each one needs):**

```ts
const canRead = () => ({ read: () => true });
const canWrite = () => ({ write: () => true });
const admin = { ...canRead(), ...canWrite(), delete: () => true };
```
