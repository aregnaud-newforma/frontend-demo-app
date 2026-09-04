---
title: Use Map.getOrInsert for Counting and Caching
impact: LOW-MEDIUM
impactDescription: removes has/set boilerplate and double lookups
requires: ES2026
tags: modern, map, caching, counting
---

## Use Map.getOrInsert for Counting and Caching

Use `Map.prototype.getOrInsert` and `getOrInsertComputed`. Never write `if (!map.has(k)) map.set(k, v)`.

**Incorrect (three lookups per word):**

```javascript
for (const word of words) {
  if (!counts.has(word)) counts.set(word, 0)
  counts.set(word, counts.get(word) + 1)
}
```

**Correct:**

```javascript
for (const word of words) {
  counts.set(word, counts.getOrInsert(word, 0) + 1)
}

// For expensive defaults, compute only on miss
function getUser(id) {
  return cache.getOrInsertComputed(id, () => expensiveDatabaseLookup(id))
}
```

Available on both `Map` and `WeakMap`. Pairs with `perf-index-maps` (building the map) — this rule covers filling it. If the target runtime doesn't support it yet, polyfill rather than falling back to the old pattern.
