---
title: Declare Return Types on Top-Level Functions
impact: LOW
impactDescription: intent readable without inference
tags: typescript, return-types, functions, modules
---

## Declare Return Types on Top-Level Functions

When declaring functions at the top level of a module, declare their return types. The contract then reads at the signature, and an implementation change that alters the return type fails at the function instead of rippling into callers.

**Correct:**

```ts
const myFunc = (): string => {
  return "hello";
};
```

**Exception — components returning JSX need no annotation:**

```tsx
const MyComponent = () => {
  return <div>Hello</div>;
};
```
