---
title: No New Enums — Use as const Objects
impact: MEDIUM
impactDescription: avoids enum runtime surprises
tags: typescript, enums, as-const, constants
---

## No New Enums — Use as const Objects

Do not introduce new enums into the codebase. Retain existing ones.

**Correct (enum-like behaviour from an `as const` object):**

```ts
const backendToFrontendEnum = {
  xs: "EXTRA_SMALL",
  sm: "SMALL",
  md: "MEDIUM",
} as const;

type LowerCaseEnum = keyof typeof backendToFrontendEnum; // "xs" | "sm" | "md"

type UpperCaseEnum = (typeof backendToFrontendEnum)[LowerCaseEnum]; // "EXTRA_SMALL" | "SMALL" | "MEDIUM"
```

One of the surprises this avoids — numeric enums produce a reverse mapping:

```ts
enum Direction {
  Up,
  Down,
  Left,
  Right,
}

const direction = Direction.Up; // 0
const directionName = Direction[0]; // "Up"

Object.keys(Direction).length; // 8, not 4
```
