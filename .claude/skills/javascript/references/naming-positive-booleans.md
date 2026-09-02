---
title: Name Booleans in the Positive Form
impact: LOW
impactDescription: no double-negative reasoning
tags: naming, booleans, readability
---

## Name Booleans in the Positive Form

The positive form of a condition is easier to comprehend. A negated name forces double-negative reasoning at every use site (`!shouldNotUpdate`).

**Incorrect:**

```javascript
let shouldNotUpdate = false
if (!shouldNotUpdate) {
  update()
}
```

**Correct:**

```javascript
let shouldUpdate = true
if (shouldUpdate) {
  update()
}
```
