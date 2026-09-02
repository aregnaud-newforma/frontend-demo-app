---
title: Group State That Updates Together
impact: LOW
impactDescription: prevents partial updates and forgotten setters
tags: state, useState, structure
---

## Group State That Updates Together

If two or more state variables are always updated at the same time, merge them into one. Separate variables invite a code path that updates one and forgets the other.

**Incorrect (nothing ties x and y together):**

```tsx
const [x, setX] = useState(0)
const [y, setY] = useState(0)
```

**Correct (one update, always consistent):**

```tsx
const [position, setPosition] = useState({ x: 0, y: 0 })
```

Only group state that genuinely moves together — merging unrelated fields into one object forces every update to spread the rest.

Reference: [Group related state](https://react.dev/learn/choosing-the-state-structure#group-related-state)
