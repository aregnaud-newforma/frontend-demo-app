---
title: Do Not Recreate Lifecycle Hooks
impact: LOW-MEDIUM
impactDescription: keeps effect dependencies visible to the linter
tags: hooks, useEffect, lifecycle, lint
---

## Do Not Recreate Lifecycle Hooks

Do not wrap `useEffect` in lifecycle-shaped hooks like `useMount`, `useUpdateEffect`, or `useUnmount`. They hide the dependency array from the exhaustive-deps lint rule and pretend React has a lifecycle, when effects actually model synchronization. Write the effect directly so the linter can verify its dependencies.

**Incorrect (dependencies invisible to the linter):**

```tsx
function useMount(fn: () => void) {
  useEffect(() => {
    fn()
  }, []) // fn is a hidden dependency
}

useMount(() => {
  connect(roomId) // roomId changes are silently ignored
})
```

**Correct (the linter sees every dependency):**

```tsx
useEffect(() => {
  connect(roomId)
  return () => disconnect(roomId)
}, [roomId])
```

Reference: [Custom "lifecycle" Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks#avoid-custom-lifecycle-hooks)
