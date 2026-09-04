---
title: Prefer Hooks Over HOCs and Render Props
impact: LOW-MEDIUM
impactDescription: flattens component trees and simplifies logic reuse
requires: React >=19
tags: hooks, hoc, render-props, patterns
---

## Prefer Hooks Over HOCs and Render Props

Higher-order components, render props, and container/presentational splits all exist to share stateful logic — the problem hooks solve directly. When you meet one of these patterns, extract the logic into a custom hook: no wrapper components, no prop-name collisions, no extra tree depth.

**Incorrect (HOC wraps a component to inject data):**

```tsx
function withLoader(Component: ComponentType<{ data: Data }>, url: string) {
  return function LoaderComponent(props: object) {
    const [data, setData] = useState<Data | null>(null)

    useEffect(() => {
      fetch(url)
        .then((res) => res.json())
        .then(setData)
    }, [])

    if (!data) return <div>Loading...</div>
    return <Component {...props} data={data} />
  }
}

const UserList = withLoader(List, '/api/users')
```

**Correct (the same logic as a hook the component calls):**

```tsx
function useLoader(url: string) {
  const [data, setData] = useState<Data | null>(null)

  useEffect(() => {
    let ignore = false
    fetch(url)
      .then((res) => res.json())
      .then((json) => {
        if (!ignore) setData(json)
      })
    return () => {
      ignore = true
    }
  }, [url])

  return data
}

function UserList() {
  const data = useLoader('/api/users')
  if (!data) return <div>Loading...</div>
  return <List data={data} />
}
```

The same rewrite applies to render props (`<MouseTracker>{(pos) => ...}</MouseTracker>` becomes `useMousePosition()`) and to container components whose only job is fetching for a presentational child (the fetch becomes a hook the child calls). For data fetching specifically, prefer a query library over a hand-rolled effect.
