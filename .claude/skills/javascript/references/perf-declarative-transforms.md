---
title: Prefer Declarative Transformations
impact: LOW-MEDIUM
impactDescription: intent-revealing data transformations
tags: javascript, arrays, declarative, readability
---

## Prefer Declarative Transformations

Imperative code says how you do something; declarative code says what you do. Prefer chained array methods over a `reduce` or a hand-written loop — they read closer to the intent.

**Incorrect (reduce rebuilding an array element by element):**

```javascript
function filteredAndDouble(arr, itemToFilter) {
  return arr.reduce((prev, current) => {
    if (current === itemToFilter) {
      return prev
    }
    return [...prev, current * 2]
  }, [])
}
```

**Correct:**

```javascript
function filteredAndDouble(arr, itemToFilter) {
  return arr.filter((item) => item !== itemToFilter).map((item) => item * 2)
}
```

**Boundary with performance rules.** This is the default. On a measured hot path or a very large collection, `perf-combine-iterations` legitimately trades this readability for a single loop — apply it there and only there. Before dropping to a loop, check the declarative single-pass options: `.flatMap()` for map+filter in one pass (`perf-flatmap-filter`), and lazy Iterator helpers for pipelines that stay declarative without intermediate arrays (`modern-iterator-helpers`).
