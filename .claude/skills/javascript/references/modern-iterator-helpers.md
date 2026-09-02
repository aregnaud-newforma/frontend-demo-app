---
title: Use Iterator Helpers for Large or Infinite Sequences
impact: LOW-MEDIUM
impactDescription: lazy evaluation, no intermediate arrays
tags: modern, iterators, lazy, performance
---

## Use Iterator Helpers for Large or Infinite Sequences

Use `Iterator.prototype` methods (`.map`, `.filter`, `.take`, `.drop`, `.toArray`). They are lazy, so they work on infinite iterators, stop pulling upstream as soon as the result is complete, and allocate no intermediate arrays. They also keep multi-step transformations declarative in a single pass — resolving the usual tension between chained array methods and a hand-written loop.

**Incorrect (materializes the whole sequence):**

```javascript
const firstTenEvenSquares = []
for (const n of naturalNumbers()) {
  if (n % 2 === 0) {
    firstTenEvenSquares.push(n * n)
    if (firstTenEvenSquares.length === 10) break
  }
}
```

**Correct (lazy, stops pulling upstream after 10):**

```javascript
const firstTenEvenSquares = naturalNumbers()
  .filter((n) => n % 2 === 0)
  .map((n) => n * n)
  .take(10)
  .toArray()
```

If the target runtime doesn't support them yet, polyfill rather than falling back to the old pattern.
