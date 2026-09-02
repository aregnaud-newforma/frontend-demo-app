---
title: Use Iterator.from Instead of Spreading Into an Array
impact: LOW-MEDIUM
impactDescription: no intermediate array allocation
tags: modern, iterators, nodelist, performance
---

## Use Iterator.from Instead of Spreading Into an Array

To use array methods on a NodeList, Set, or Map, wrap it with `Iterator.from(x)` instead of `[...x]` or `Array.from(x)`. The chain stays lazy and allocates no intermediate array.

**Incorrect (allocates an intermediate array):**

```javascript
const ids = Array.from(document.querySelectorAll('.card'))
  .filter((el) => !el.classList.contains('hidden'))
  .map((el) => el.dataset.id)
```

**Correct (lazy, no intermediate array):**

```javascript
const ids = Iterator.from(document.querySelectorAll('.card'))
  .filter((el) => !el.classList.contains('hidden'))
  .map((el) => el.dataset.id)
  .toArray()
```

If the target runtime doesn't support it yet, polyfill rather than falling back to the old pattern.
