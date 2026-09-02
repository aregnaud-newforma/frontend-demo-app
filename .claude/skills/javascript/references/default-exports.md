---
title: No Default Exports
impact: LOW
impactDescription: consistent names across import sites
tags: modules, exports, imports
---

## No Default Exports

Unless explicitly required by the framework, do not use default exports. A default export lets every import site invent its own name for the same thing; named exports keep one name everywhere and survive refactoring tools.

**Incorrect:**

```js
export default function myFunction() {
  return <div>Hello</div>;
}

// importing file — any name works, nothing enforces consistency
import myFunction from "./myFunction";
```

**Correct:**

```js
export function myFunction() {
  return <div>Hello</div>;
}

import { myFunction } from "./myFunction";
```

**Exception — framework requirement:**

```js
// This is fine, if required by the framework (e.g. Next.js pages)
export default function MyPage() {
  return <div>Hello</div>;
}
```
