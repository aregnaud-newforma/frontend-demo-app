---
title: Prefer interface extends Over Intersections
impact: MEDIUM
impactDescription: intersections have terrible checker performance
tags: typescript, interface, intersection, performance
---

## Prefer interface extends Over Intersections

ALWAYS prefer interfaces when modelling inheritance. The `&` operator has terrible performance in TypeScript — the checker re-computes the intersection at every use instead of caching a named shape. Only use `&` where `interface extends` is not possible.

**Incorrect:**

```ts
type A = {
  a: string;
};

type B = {
  b: string;
};

type C = A & B;
```

**Correct:**

```ts
interface A {
  a: string;
}

interface B {
  b: string;
}

interface C extends A, B {
  // Additional properties can be added here
}
```

For everything that is not inheritance, default to `type` — see [modeling-type-vs-interface.md](modeling-type-vs-interface.md).
