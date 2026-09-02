---
title: Keep Custom Hooks Pure
impact: HIGH
impactDescription: prevents render-time mutation bugs
tags: hooks, purity, render
---

## Keep Custom Hooks Pure

The body of a custom hook re-runs on every render of the component that calls it. Any mutation it performs — on its arguments, on shared objects — happens during render, repeatedly, and corrupts state the caller still holds.

**Incorrect (mutates the caller's array during render):**

```tsx
function useSortedItems(items: Item[]) {
  items.sort() // caller's array is now reordered, every render
  return items
}
```

**Correct (returns a new array, input untouched):**

```tsx
function useSortedItems(items: Item[]) {
  return items.toSorted()
}
```

Side effects belong in event handlers or in effects inside the hook — never in the hook body itself.

Reference: [Keeping components pure](https://react.dev/learn/keeping-components-pure)
