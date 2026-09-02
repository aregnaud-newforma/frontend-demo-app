---
title: Pass Children as Props to Stateful Wrappers
impact: HIGH
impactDescription: children skip re-renders caused by wrapper state
tags: rerender, children, composition, optimization
---

## Pass Children as Props to Stateful Wrappers

When a stateful component visually wraps expensive content, accept that content as `children` instead of rendering it inline. `children` is created in the parent's scope: when the wrapper's own state updates, the element reference is unchanged, so React skips re-rendering it — no `memo` needed.

**Incorrect (scroll state re-renders every sibling):**

```tsx
const App = () => {
  const [position, setPosition] = useState(300)
  const onScroll = (e: UIEvent) => setPosition(getPosition(e.currentTarget.scrollTop))
  return (
    <div className="scrollable-block" onScroll={onScroll}>
      <MovingBlock position={position} />
      <VerySlowComponent />
      <BunchOfStuff />
    </div>
  )
}
```

**Correct (state moved into the wrapper, children stay referentially stable):**

```tsx
const ScrollableWithMovingBlock = ({ children }: { children: ReactNode }) => {
  const [position, setPosition] = useState(300)
  const onScroll = (e: UIEvent) => setPosition(getPosition(e.currentTarget.scrollTop))
  return (
    <div className="scrollable-block" onScroll={onScroll}>
      <MovingBlock position={position} />
      {children}
    </div>
  )
}

const App = () => (
  <ScrollableWithMovingBlock>
    <VerySlowComponent /> {/* untouched by position updates */}
    <BunchOfStuff />
  </ScrollableWithMovingBlock>
)
```

When the wrapper needs more than one slot, the same mechanism works through named props (`content`, `footer`, `icon`) — any element created in the parent's scope is stable across the wrapper's own re-renders.
