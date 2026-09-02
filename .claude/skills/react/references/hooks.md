## When to Extract a Custom Hook

Consider extracting a hook when one of these is true:

- You're duplicating stateful logic across components
- You're synchronizing with an external system (browser APIs, subscriptions, libraries)
- You want to hide complexity behind a clear name

This file covers hooks you extract for your own reuse. Shipping a hook as a component's
public API, so consumers drive it from outside, is a different trade-off — see
`references/patterns.md`.

## When Not to Extract a Custom Hook

Some extractions look helpful but aren't.

- Not for every small bit of duplicated code — wrapping a single `useState`
  call in `useFormInput` adds indirection, not value.
- No lifecycle hooks (`useMount`, `useUpdateEffect`) — they hide dependencies
  from the linter and pretend React has a lifecycle when it works through
  synchronization. [hooks-no-lifecycle.md](hooks-no-lifecycle.md)
- No `use` prefix on pure helpers — a function that calls no hooks
  (`formatCurrency`, `sumPrices`) is a regular function.
- Don't reinvent the wheel — before writing a custom hook for a common need,
  check whether one already exists.

## Rules

- **Custom hooks must be pure.** The body re-runs on every render of the
  component that uses it; a mutation there corrupts the caller's data every
  render. [hooks-pure.md](hooks-pure.md)
- **Name hooks after their purpose and constrain their API.** One concrete,
  high-level use case per hook; a god hook whose API does not constrain its
  use cases couples every caller to everything it does.
  [hooks-focused-api.md](hooks-focused-api.md)

## Composing Hooks from Hooks

Custom Hooks compose. Build small, focused primitives and combine them into bigger ones.

```jsx
function useLocalStorage(key, initialValue) {
  //generic useLocalStorage(): hook
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

function useTheme() {
  const [theme, setTheme] = useLocalStorage("theme", "light");
  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));
  return { theme, toggleTheme };
}
```

## Event Handler Props

A callback prop used inside an effect re-runs the effect on every parent
re-render. Wrap it with `useEffectEvent` (React 19.2+) so the effect keeps a
stable reference. [effects-effect-event.md](effects-effect-event.md)

## Replace legacy patterns with custom hooks

Higher-order components, render props, and container/presentational splits all
exist to share stateful logic — the problem hooks solve directly. When you meet
one, extract the logic into a custom hook: no wrapper components, no prop-name
collisions, no extra tree depth.
[hooks-over-legacy-patterns.md](hooks-over-legacy-patterns.md)

## Per-rule references

| Whenever you deal with a...                          | Read                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| hook with side effects at call time                  | [hooks-pure.md](hooks-pure.md)                                     |
| hook serving several unrelated use cases             | [hooks-focused-api.md](hooks-focused-api.md)                       |
| `useMount`/`useUpdateEffect`-style lifecycle wrapper | [hooks-no-lifecycle.md](hooks-no-lifecycle.md)                     |
| HOC or render-prop pattern                           | [hooks-over-legacy-patterns.md](hooks-over-legacy-patterns.md)     |
