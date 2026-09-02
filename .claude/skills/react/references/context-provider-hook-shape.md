---
title: Export a Provider and a Hook, Not the Raw Context
impact: MEDIUM
impactDescription: fails fast on misuse and keeps the context API sealed
tags: context, provider, hooks, api-design
---

## Export a Provider and a Hook, Not the Raw Context

Never export the context object itself. Export a provider component and a consumer hook that throws when used outside the provider. A component rendered outside the tree then fails at the hook call with a clear message, instead of reading `undefined` and crashing somewhere downstream.

**Incorrect (raw context escapes, misuse fails silently):**

```tsx
export const ThemeContext = createContext<Theme | undefined>(undefined)

// consumer, anywhere:
const theme = useContext(ThemeContext) // undefined outside the provider, no error
```

**Correct (sealed API, loud failure at the source):**

```tsx
const ThemeContext = createContext<Theme | undefined>(undefined)

export function useThemeContext() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider')
  }
  return context
}

export function ThemeProvider({ children, value }: { children: ReactNode; value: Theme }) {
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
```

The throw also narrows the hook's return type: consumers get `Theme`, not `Theme | undefined`.
