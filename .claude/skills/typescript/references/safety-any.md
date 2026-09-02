---
title: Avoid any Outside Generic Function Bodies
impact: MEDIUM
impactDescription: preserves type safety everywhere it matters
tags: typescript, any, generics, type-safety
---

## Avoid any Outside Generic Function Bodies

Over-using `any` defeats the purpose of TypeScript. Avoid it wherever possible — implicitly or explicitly. The one place it earns its keep is inside the body of a generic function, where TypeScript often cannot match runtime logic to conditional return types.

**Incorrect at the type level (errors, though the logic is right):**

```ts
const youSayGoodbyeISayHello = <TInput extends "hello" | "goodbye">(
  input: TInput,
): TInput extends "hello" ? "goodbye" : "hello" => {
  if (input === "goodbye") {
    return "hello"; // Error!
  } else {
    return "goodbye"; // Error!
  }
};
```

**Correct (any as the concise escape hatch, contained in the body):**

```ts
const youSayGoodbyeISayHello = <TInput extends "hello" | "goodbye">(
  input: TInput,
): TInput extends "hello" ? "goodbye" : "hello" => {
  if (input === "goodbye") {
    return "hello" as any;
  } else {
    return "goodbye" as any;
  }
};
```

The signature stays fully typed — callers never see the `any`. Outside generic function bodies, use `any` extremely sparingly.
