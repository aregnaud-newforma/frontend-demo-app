---
title: Normalize Deeply Nested State
impact: LOW-MEDIUM
impactDescription: simplifies immutable updates
tags: state, structure, normalization
---

## Normalize Deeply Nested State

Updating a node buried several levels deep means copying every ancestor on the path. Store hierarchical data flat — a map of items by id, each holding child ids — so any node updates with a single spread.

**Incorrect (updating Botswana copies the whole path to the root):**

```tsx
const initialTravelPlan = {
  id: 0,
  title: '(Root)',
  childPlaces: [
    {
      id: 1,
      title: 'Earth',
      childPlaces: [
        { id: 2, title: 'Africa', childPlaces: [{ id: 3, title: 'Botswana', childPlaces: [] }] },
      ],
    },
  ],
}
```

**Correct (any node is one level deep):**

```tsx
const initialTravelPlan = {
  0: { id: 0, title: '(Root)', childIds: [1] },
  1: { id: 1, title: 'Earth', childIds: [2] },
  2: { id: 2, title: 'Africa', childIds: [3] },
  3: { id: 3, title: 'Botswana', childIds: [] },
}
```

For complex nested state that genuinely cannot be flattened, reach for Immer rather than hand-writing nested spreads.

Reference: [Avoid deeply nested state](https://react.dev/learn/choosing-the-state-structure#avoid-deeply-nested-state)
