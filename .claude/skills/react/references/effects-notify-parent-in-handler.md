---
title: Notify Parent Components in Event Handlers, Not Effects
impact: MEDIUM
impactDescription: avoids an extra render pass and keeps data flow traceable
tags: effects, events, callbacks, data-flow
---

## Notify Parent Components in Event Handlers, Not Effects

When a child needs to tell its parent about a change, call the parent's callback in the same event handler that updates the state. An effect that watches the state fires one render later, and also fires for state changes the parent never asked to hear about.

**Incorrect (parent notified a render late, on every isOn change):**

```tsx
function Toggle({ onChange }: { onChange: (on: boolean) => void }) {
  const [isOn, setIsOn] = useState(false)

  useEffect(() => {
    onChange(isOn)
  }, [isOn, onChange])

  function handleClick() {
    setIsOn(!isOn)
  }

  return <button onClick={handleClick}>{isOn ? 'On' : 'Off'}</button>
}
```

**Correct (both updates in one pass — React batches them):**

```tsx
function Toggle({ onChange }: { onChange: (on: boolean) => void }) {
  const [isOn, setIsOn] = useState(false)

  function handleClick() {
    const next = !isOn
    setIsOn(next)
    onChange(next)
  }

  return <button onClick={handleClick}>{isOn ? 'On' : 'Off'}</button>
}
```

Reference: [Notifying parent components about state changes](https://react.dev/learn/you-might-not-need-an-effect#notifying-parent-components-about-state-changes)
