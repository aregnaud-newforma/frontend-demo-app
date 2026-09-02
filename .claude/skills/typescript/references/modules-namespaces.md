---
title: ES Modules Over Namespaces
impact: LOW
impactDescription: namespaces are legacy in module code
tags: typescript, namespaces, modules, globals
---

## ES Modules Over Namespaces

Use ES modules rather than namespaces. Now that ES modules are widely supported, namespaces have very little relevance in modern TypeScript code.

**Exception — declaring global types:**

```ts
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly DATABASE_URL: string;
    }
  }
}
```
