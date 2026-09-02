---
title: Expect undefined from Indexed Access
impact: MEDIUM
impactDescription: indexing returns T | undefined under this flag
tags: typescript, tsconfig, indexing, undefined
---

## Expect undefined from Indexed Access

When `noUncheckedIndexedAccess` is enabled in `tsconfig.json`, indexing into objects and arrays behaves differently from what you may expect: every indexed read includes `undefined`. Check the flag before writing index-heavy code, and handle the `undefined` instead of asserting it away.

```ts
const obj: Record<string, string> = {};

// With noUncheckedIndexedAccess: string | undefined
// Without it: string
const value = obj.key;
```

```ts
const arr: string[] = [];

// With noUncheckedIndexedAccess: string | undefined
// Without it: string
const value = arr[0];
```
