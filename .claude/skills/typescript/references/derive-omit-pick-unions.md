---
title: Use Distributive Omit/Pick on Unions
impact: MEDIUM
impactDescription: Omit/Pick silently collapse unions
tags: typescript, omit, pick, unions, distributive
---

## Use Distributive Omit/Pick on Unions

`Omit` and `Pick` do not distribute over union types: they collapse the union into a single object type, losing every member's own shape.

**Incorrect (union collapsed to the common shape):**

```ts
type MusicProduct = Album | CollectorEdition | DigitalRelease;

type MusicProductWithoutId = Omit<MusicProduct, "id">;
```

**Correct (distributive versions preserve each member):**

```ts
type DistributiveOmit<T, K extends PropertyKey> = T extends any
  ? Omit<T, K>
  : never;

type MusicProductWithoutId = DistributiveOmit<MusicProduct, "id">;

type DistributivePick<T, K extends PropertyKey> = T extends any
  ? Pick<T, K>
  : never;

type MusicProductId = DistributivePick<MusicProduct, "id">;
```

The `any` in the conditional is load-bearing — it is what triggers distribution — not a violation of [safety-any.md](safety-any.md).
