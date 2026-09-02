---
title: Default to type Over interface
impact: MEDIUM
impactDescription: no silent declaration merging
tags: typescript, type, interface, declaration-merging
---

## Default to type Over interface

Default to `type`. It is more flexible and does not declaration-merge unexpectedly.

**Correct (plain shapes, and things only type can do):**

```ts
type User = {
  readonly id: string;
  readonly email: string;
};

type Status = "idle" | "loading" | "done";
type UserId = User["id"];
```

**Incorrect (interface re-opens — both declarations are legal, User silently grows):**

```ts
interface User {
  id: string;
}

interface User {
  email: string;
  isAdmin: boolean;
}
// User now has all three properties, including ones you never declared
```

Reach for `interface` only when modelling inheritance — see [modeling-interface-extends.md](modeling-interface-extends.md).
