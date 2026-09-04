---
title: Use Promise.try for Maybe-Sync Functions
impact: LOW-MEDIUM
impactDescription: one error path instead of two
requires: ES2025
tags: modern, promises, async, error-handling
---

## Use Promise.try for Maybe-Sync Functions

When calling a function that might be sync, async, or throw synchronously, wrap it in `Promise.try(() => fn())`. Sync throws, async rejections, and plain return values all flow through the same `.then`/`.catch`.

**Incorrect (two error paths to remember):**

```javascript
try {
  const result = thirdParty.doThing()
  Promise.resolve(result).then(processResult).catch(handleAnyFailure)
} catch (err) {
  handleAnyFailure(err)
}
```

**Correct:**

```javascript
Promise.try(() => thirdParty.doThing())
  .then(processResult)
  .catch(handleAnyFailure)
```

If the target runtime doesn't support it yet, polyfill rather than falling back to the old pattern.
