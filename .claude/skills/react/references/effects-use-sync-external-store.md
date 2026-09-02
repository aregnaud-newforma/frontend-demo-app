---
title: Use useSyncExternalStore for External Stores
impact: LOW-MEDIUM
impactDescription: correct subscriptions without effect boilerplate
tags: effects, useSyncExternalStore, subscriptions, browser-apis
---

## Use useSyncExternalStore for External Stores

To read a value owned by an external store (browser APIs, third-party stores), do not wire listeners manually with `useEffect` + `useState`. `useSyncExternalStore` handles the subscription lifecycle, avoids tearing, and provides a server snapshot for SSR.

**Incorrect (manual listener wiring):**

```tsx
const [isOnline, setIsOnline] = useState(true)

useEffect(() => {
  const handler = () => setIsOnline(navigator.onLine)
  window.addEventListener('online', handler)
  window.addEventListener('offline', handler)
  return () => {
    window.removeEventListener('online', handler)
    window.removeEventListener('offline', handler)
  }
}, [])
```

**Correct (subscription handled by React):**

```tsx
function subscribe(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

const isOnline = useSyncExternalStore(
  subscribe,
  () => navigator.onLine, // client snapshot
  () => true, // server snapshot
)
```

Declare `subscribe` outside the component (or in a custom hook) so the subscription is not torn down and recreated on every render.

Reference: [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
