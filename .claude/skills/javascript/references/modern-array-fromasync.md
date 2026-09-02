---
title: Use Array.fromAsync to Collect Async Iterables
impact: LOW
impactDescription: removes manual accumulation loops
tags: modern, async, iterators, arrays
---

## Use Array.fromAsync to Collect Async Iterables

Use `Array.fromAsync`. Never write a manual `for await...of` loop whose only job is pushing items into an array.

**Incorrect:**

```javascript
const allItems = []
for await (const item of fetchPages()) allItems.push(item)
```

**Correct:**

```javascript
const allItems = await Array.fromAsync(fetchPages())
```

A `for await...of` loop remains the right tool when you process items as they arrive instead of collecting them.
