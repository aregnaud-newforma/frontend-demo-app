---
title: Split Context Into Value and API Contexts
impact: MEDIUM
impactDescription: consumers of stable APIs stop re-rendering on value changes
requires: React Compiler off
tags: context, rerender, optimization
---

## Split Context Into Value and API Contexts

When a context value changes, every consumer re-renders — including components that only call the setters and never read the value. Split the context in two: one for the data that changes, one for the functions that do not. Components that only trigger changes then never re-render from them.

Only split when the re-renders being prevented actually cost something; measure first.

**Incorrect (the Open button re-renders every time the nav toggles):**

```tsx
const NavigationContext = createContext({ isNavExpanded: false, open: () => {}, close: () => {} })
```

**Correct (API consumers are isolated from value changes):**

```tsx
const ContextData = createContext({ isNavExpanded: false })
const ContextApi = createContext({ open: () => {}, close: () => {} })

const NavigationController = ({ children }: { children: ReactNode }) => {
  const [isNavExpanded, setIsNavExpanded] = useState(false)

  const open = () => setIsNavExpanded(true)
  const close = () => setIsNavExpanded(false)

  return (
    <ContextData.Provider value={{ isNavExpanded }}>
      <ContextApi.Provider value={{ open, close }}>{children}</ContextApi.Provider>
    </ContextData.Provider>
  )
}

// re-renders only when the nav actually expands or collapses
const Columns = () => {
  const { isNavExpanded } = useNavigationData()
  return isNavExpanded ? <TwoColumns /> : <ThreeColumns />
}

// never re-renders from nav state at all
const OpenButton = () => {
  const { open } = useNavigationApi()
  return <button onClick={open}>Open</button>
}
```

If a handler needs to read the current state (`toggle`), switch to `useReducer`: handlers dispatch actions and stay stable while the reducer reads the state.

```tsx
const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'toggle-sidebar':
      // the old value is right here in `state` — just flip it
      return { ...state, isNavExpanded: !state.isNavExpanded }
    case 'open-sidebar':
      return { ...state, isNavExpanded: true }
    case 'close-sidebar':
      return { ...state, isNavExpanded: false }
  }
}

const [state, dispatch] = useReducer(reducer, defaultState)
const api = {
  open: () => dispatch({ type: 'open-sidebar' }),
  close: () => dispatch({ type: 'close-sidebar' }),
  toggle: () => dispatch({ type: 'toggle-sidebar' }),
}
```

**Note:** Without React Compiler, both provider values need `useMemo` and the handlers `useCallback`, or the split buys nothing. With the compiler enabled, write them plainly.
