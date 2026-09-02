---
title: Prefer | undefined Over Optional Properties
impact: MEDIUM
impactDescription: forgotten fields become compile errors
tags: typescript, optional, undefined, properties
---

## Prefer | undefined Over Optional Properties

Use optional properties (`?`) extremely sparingly — only when the property is truly optional. When forgetting to pass a value would be a bug, use `| undefined` instead: the caller must then write the field explicitly, and an omission is a compile error, not a silent hole.

**Incorrect (forgetting userId anywhere silently deauthenticates):**

```ts
type AuthOptions = {
  userId?: string;
};

const func = (options: AuthOptions) => {
  const userId = options.userId;
};
```

**Correct (caller must state userId, even as undefined):**

```ts
type AuthOptions = {
  userId: string | undefined;
};

const func = (options: AuthOptions) => {
  const userId = options.userId;
};
```
