---
title: Use using for Resource Cleanup
impact: MEDIUM
impactDescription: cleanup cannot be forgotten
tags: modern, using, resources, cleanup
---

## Use using for Resource Cleanup

When opening a resource that needs cleanup, use `using` (sync) or `await using` (async). Never write `try/finally` for cleanup when `using` works — the cleanup moves to the declaration and cannot be forgotten on a new early-return path.

**Incorrect (manual cleanup, easy to forget):**

```javascript
async function transferMoney(from, to, amount) {
  const tx = await db.beginTransaction()
  try {
    await tx.debit(from, amount)
    await tx.credit(to, amount)
    await tx.commit()
  } finally {
    await tx.release()
  }
}
```

**Correct (cleanup declared with the resource):**

```javascript
async function transferMoney(from, to, amount) {
  await using tx = await db.beginTransaction()
  await tx.debit(from, amount)
  await tx.credit(to, amount)
  await tx.commit()
}
```

The resource must implement `[Symbol.dispose]` (sync) or `[Symbol.asyncDispose]` (async). Multiple `using` declarations in the same scope dispose in reverse order (LIFO). If the target runtime doesn't support it yet, polyfill rather than falling back to the old pattern.
