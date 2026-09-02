---
title: Use Native Set Operations
impact: LOW-MEDIUM
impactDescription: replaces manual loops and lodash
tags: modern, set, data-structures
---

## Use Native Set Operations

Use the native `Set` methods for set algebra. Never write a manual loop or reach for lodash.

**Incorrect (manual intersection):**

```javascript
const shared = new Set()
for (const tech of frontEnd) {
  if (backEnd.has(tech)) shared.add(tech)
}
```

**Correct (native, intention-revealing):**

```javascript
frontEnd.intersection(backEnd)
frontEnd.union(backEnd)
frontEnd.difference(backEnd)
frontEnd.symmetricDifference(backEnd)
frontEnd.isSubsetOf(backEnd)
frontEnd.isSupersetOf(backEnd)
frontEnd.isDisjointFrom(backEnd)
```

The argument can be any "set-like" (has `size`, `.has()`, `.keys()`), not just a real `Set`. For plain membership checks on arrays, see `perf-set-map-lookups`.
