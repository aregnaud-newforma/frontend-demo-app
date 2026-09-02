---
title: Guard Fetch Effects Against Race Conditions
impact: HIGH
impactDescription: prevents stale responses from overwriting fresh data
tags: effects, fetching, race-condition, cleanup
---

## Guard Fetch Effects Against Race Conditions

Prefer a data-fetching library (TanStack Query, SWR) — it handles caching, deduplication, and races. When a fetch must live in an effect, always add a cleanup that ignores the stale response: without it, a slow earlier request can resolve after a faster later one and overwrite fresh data with stale data.

**Incorrect (last response to arrive wins, not the last requested):**

```tsx
useEffect(() => {
  fetchUser(userId).then((data) => setUser(data))
}, [userId])
```

**Correct (library owns the lifecycle):**

```tsx
const { data, isLoading, error } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
})
```

**Correct (unavoidable effect, stale responses ignored):**

```tsx
useEffect(() => {
  let ignore = false
  fetchUser(userId).then((data) => {
    if (!ignore) setUser(data)
  })
  return () => {
    ignore = true
  }
}, [userId])
```

Reference: [Fetching data](https://react.dev/learn/you-might-not-need-an-effect#fetching-data)
