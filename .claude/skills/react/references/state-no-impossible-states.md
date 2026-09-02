---
title: Model State So Impossible States Cannot Exist
impact: MEDIUM
impactDescription: eliminates contradictory UI states
tags: state, useState, modeling, status
---

## Model State So Impossible States Cannot Exist

When several booleans describe one situation, some combinations are contradictions (`isLoading && hasError`), and every code path must remember to keep them in sync. Replace them with a single status value whose type only admits valid states.

**Incorrect (four combinations, two are lies):**

```tsx
const [isLoading, setIsLoading] = useState(false)
const [hasError, setHasError] = useState(false)
```

**Correct (only valid states are representable):**

```tsx
type Status = 'idle' | 'loading' | 'success' | 'error'

const [status, setStatus] = useState<Status>('idle')
```

Each transition is now one `setStatus` call instead of a coordinated pair of boolean flips that can be half-applied.

Reference: [Avoid contradictions in state](https://react.dev/learn/choosing-the-state-structure#avoid-contradictions-in-state)
