---
title: Name Intermediate Conditions
impact: LOW
impactDescription: compound conditionals become self-documenting
tags: javascript, conditionals, readability, naming
---

## Name Intermediate Conditions

A compound conditional must be evaluated as a whole by every reader. Extract each clause into a named boolean so the names carry the meaning.

**Incorrect (all clauses resolved at once):**

```ts
if (val > SOME_CONSTANT && (cond2 || cond3) && cond4 && !cond5) {
}
```

**Correct (names carry the meaning):**

```ts
const isValid = val > SOME_CONSTANT
const isAllowed = cond2 || cond3
const isSecure = cond4 && !cond5

if (isValid && isAllowed && isSecure) {
}
```
