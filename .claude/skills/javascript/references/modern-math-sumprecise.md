---
title: Use Math.sumPrecise for Summing Floats
impact: MEDIUM
impactDescription: eliminates floating-point drift
requires: ES2026
tags: modern, numbers, floats, precision
---

## Use Math.sumPrecise for Summing Floats

Use `Math.sumPrecise(values)` to sum an array of floats. Especially important for financial values or long arrays where rounding drift compounds.

**Incorrect (accumulates error):**

```javascript
const cents = Array(10000).fill(0.1)
cents.reduce((a, b) => a + b) // 1000.0000000001588
```

**Correct:**

```javascript
Math.sumPrecise(cents) // 1000
```

Also handles catastrophic cancellation: `Math.sumPrecise([1e20, 1, -1e20])` returns `1`, not `0`. If the target runtime doesn't support it yet, polyfill rather than falling back to the old pattern.
