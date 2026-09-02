---
title: Use RegExp.escape for User-Controlled Patterns
impact: MEDIUM
impactDescription: removes home-grown escaping bugs
tags: modern, regexp, escaping, input
---

## Use RegExp.escape for User-Controlled Patterns

When building a regex from user-controlled input, use `RegExp.escape(input)` instead of a custom escape function.

**Incorrect (every codebase ships its own buggy version):**

```javascript
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
```

**Correct:**

```javascript
const pattern = new RegExp(RegExp.escape(userInput))
```

For hot-path regexes, also hoist construction out of loops — see `perf-hoist-regexp`. If the target runtime doesn't support it yet, polyfill rather than falling back to a hand-rolled escape.
