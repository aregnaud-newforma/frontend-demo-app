---
title: readonly Properties by Default
impact: LOW-MEDIUM
impactDescription: accidental mutation becomes a compile error
tags: typescript, readonly, immutability, properties
---

## readonly Properties by Default

Mark object type properties `readonly` by default. Omit it only when the property is genuinely mutable.

**Incorrect (mutation compiles):**

```ts
type User = {
  id: string;
};

const user: User = {
  id: "1",
};

user.id = "2";
```

**Correct (mutation is a compile error):**

```ts
type User = {
  readonly id: string;
};

const user: User = {
  id: "1",
};

user.id = "2"; // Error
```
