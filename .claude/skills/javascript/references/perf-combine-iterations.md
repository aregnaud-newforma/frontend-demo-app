---
title: Combine Multiple Array Iterations
impact: LOW-MEDIUM
impactDescription: reduces iterations
tags: javascript, arrays, loops, performance
---

## Combine Multiple Array Iterations

Multiple `.filter()` or `.map()` calls iterate the array multiple times. Combine into one loop.

**Incorrect (3 iterations):**

```typescript
const admins = users.filter(u => u.isAdmin)
const testers = users.filter(u => u.isTester)
const inactive = users.filter(u => !u.isActive)
```

**Correct (1 iteration):**

```typescript
const admins: User[] = []
const testers: User[] = []
const inactive: User[] = []

for (const user of users) {
  if (user.isAdmin) admins.push(user)
  if (user.isTester) testers.push(user)
  if (!user.isActive) inactive.push(user)
}
```

**Boundary with `perf-declarative-transforms`.** That rule is the default: declarative chains read closer to the intent. Reach for this loop only when the iteration count actually matters — a measured hot path or a large collection. For map+filter, `.flatMap()` gives one pass while staying declarative (`perf-flatmap-filter`), and lazy Iterator helpers do the same for whole pipelines (`modern-iterator-helpers`); prefer those before a manual loop.
