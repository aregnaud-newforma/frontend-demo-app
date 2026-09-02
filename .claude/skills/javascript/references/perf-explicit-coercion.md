---
title: Prefer Explicit Coercion, or None at All
impact: LOW
impactDescription: coercion intent is visible
tags: javascript, conditionals, coercion, booleans
---

## Prefer Explicit Coercion, or None at All

Use `Boolean(x)` when you genuinely need to turn a value into a boolean, and nothing when you are already in a boolean context.

**Incorrect (!! coerces, but reads as a hack):**

```javascript
const isEnabled = !!user.accessRights
```

**Correct (Boolean() says exactly what it does):**

```javascript
const isEnabled = Boolean(user.accessRights)
```

**Correct (already a boolean context — no coercion needed):**

```javascript
if (user.accessRights) {
  // ...
}
```
