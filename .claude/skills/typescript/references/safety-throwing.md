---
title: Prefer Result Types Over Thrown Errors
impact: MEDIUM
impactDescription: error handling visible in the signature
tags: typescript, errors, result-type, throwing
---

## Prefer Result Types Over Thrown Errors

Think carefully before writing code that throws. If a thrown error produces a desirable outcome in the system — a custom error inside a backend framework's request handler — go for it. But for code the caller would need a manual `try/catch` around, return a result type instead: the failure becomes part of the signature and cannot be forgotten.

**Correct (the shape):**

```ts
type Result<T, E extends Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

**Correct (throwing contained at the boundary):**

```ts
const parseJson = (input: string): Result<unknown, Error> => {
  try {
    return { ok: true, value: JSON.parse(input) };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
};
```

**Correct (caller handles both paths explicitly):**

```ts
const result = parseJson('{"name": "John"}');

if (result.ok) {
  console.log(result.value);
} else {
  console.error(result.error);
}
```
