---
title: Use import defer for Rarely-Used Heavy Modules
impact: LOW-MEDIUM
impactDescription: skips module evaluation until first use
requires: module ESNext or Preserve
tags: modern, modules, lazy, startup
---

## Use import defer for Rarely-Used Heavy Modules

Use `import defer` to delay a module's evaluation until you actually read a property off its namespace.

**Incorrect (heavy.js evaluates on import, even if never used):**

```javascript
import * as heavyModule from './heavy.js'
```

**Correct (fetched and parsed, but not executed):**

```javascript
import defer * as heavyModule from './heavy.js'

function rarelyCalled() {
  // Reading heavyModule.doExpensiveThing triggers evaluation here
  return heavyModule.doExpensiveThing()
}
```

Restrictions: namespace form only (no `import defer { foo }` or default imports), and modules that use top-level `await` can't be deferred. To skip the download as well, not just evaluation, use a dynamic `import()` behind the call site instead.
