---
title: Use Error.isError Instead of instanceof
impact: MEDIUM
impactDescription: reliable across realms
requires: ES2026
tags: modern, errors, instanceof, workers
---

## Use Error.isError Instead of instanceof

Use `Error.isError(x)` to check whether a caught value is an Error. `instanceof Error` is unreliable across realms (Workers, iframes, Node `vm`) because each realm has its own `Error` constructor.

**Incorrect (fails for errors from Workers/iframes):**

```javascript
if (maybeError instanceof Error) { /* ... */ }
```

**Correct:**

```javascript
if (Error.isError(maybeError)) { /* ... */ }
```

If the target runtime doesn't support it yet, polyfill rather than falling back to the old pattern.
