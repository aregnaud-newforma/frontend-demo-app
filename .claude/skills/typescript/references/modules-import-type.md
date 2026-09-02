---
title: Use Top-Level import type
impact: LOW-MEDIUM
impactDescription: type imports fully erased at transpilation
tags: typescript, imports, import-type, modules
---

## Use Top-Level import type

Use `import type` whenever you import a type, and prefer the top-level form over inline `type` specifiers.

**Incorrect:**

```ts
import { type User } from "./user";
```

**Correct:**

```ts
import type { User } from "./user";
```

In certain environments the inline form's import is not erased — you're left with a side-effectful import of a module you only needed types from:

```ts
// Before transpilation
import { type User } from "./user";

// After transpilation
import "./user";
```
