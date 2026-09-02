---
title: Use Optional Chaining Over && Guards
impact: LOW
impactDescription: shorter and handles all nullish cases
tags: javascript, conditionals, optional-chaining, nullish
---

## Use Optional Chaining Over && Guards

Use `?.` to reach into a value that may be `null` or `undefined`, instead of chaining `&&` guards.

**Incorrect:**

```javascript
user && user.name
user && user.getProfile && user.getProfile()
```

**Correct:**

```javascript
user?.name
user?.getProfile?.()
```

Pair with `??` for defaults — `user?.name ?? 'Anonymous'` — rather than `||`, which also swallows `''` and `0`.
