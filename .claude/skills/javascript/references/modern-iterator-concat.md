---
title: Use Iterator.concat Instead of yield* Generators
impact: LOW
impactDescription: removes generator boilerplate
requires: ES2026
tags: modern, iterators, generators
---

## Use Iterator.concat Instead of yield* Generators

To chain iterators, use `Iterator.concat(a, b)` instead of writing a generator whose only job is `yield*`.

**Incorrect (boilerplate generator):**

```javascript
function* chained() {
  yield* first()
  yield* second()
}
```

**Correct:**

```javascript
const all = Iterator.concat(first(), second())
```

If the target runtime doesn't support it yet, polyfill rather than falling back to the old pattern.
