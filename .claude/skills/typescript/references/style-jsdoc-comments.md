---
title: Concise JSDoc, Only When Not Self-Evident
impact: LOW
impactDescription: hover docs where they add information
tags: typescript, jsdoc, comments, documentation
---

## Concise JSDoc, Only When Not Self-Evident

Use JSDoc comments to annotate functions and types — but be concise, and only when the behaviour is not self-evident from the name and signature. Use the inline `{@link}` tag to reference other functions and types in the same file.

**Correct:**

```ts
/**
 * Subtracts two numbers
 */
const subtract = (a: number, b: number) => a - b;

/**
 * Does the opposite to {@link subtract}
 */
const add = (a: number, b: number) => a + b;
```
