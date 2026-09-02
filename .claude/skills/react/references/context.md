## Before you use context

Needing to pass a prop several levels deep is not, on its own, a reason for context. Always try these first.

**1. Pass props.** For non-trivial components, threading several props through a few layers is normal. It feels like a slog, but it makes the data flow explicit

**2. Compose.** If data passes through many intermediate components that do not use it and only forward it, that usually means a component was never extracted.
Composition shrinks the distance between the component holding the data and the one that needs it, often to zero. The shapes this takes: `references/patterns.md`.

Reach for context when neither works — when the information is genuinely needed by distant components in different parts of the tree.

### What context is actually for

- **Theming** — the app's appearance, e.g. a dark mode toggle.
- **Current account** — the logged-in user, which many components need.
- **Routing** — most routers hold the current route in context internally.
- **State shared by distant components** — state that ends up near the top because many components far below it need to read or change it.

## The cost

When a context value changes, **every consumer re-renders** — including consumers that only read a part of the value that did not change.
Worse, this fires **whenever the providing component re-renders**, whether or not the state you passed in was what changed.

## Shape

Always export a provider component and a hook that throws outside its provider —
never the raw context object. Misuse then fails loudly at the hook call instead
of reading `undefined` downstream.
[context-provider-hook-shape.md](context-provider-hook-shape.md)

## Performance improvement

Split the context in two — one for the value that changes, one for the API
functions that do not — so components that only trigger changes never re-render
from them. Only split when the prevented re-renders actually cost something.
The example, the `useReducer` variant for handlers that read state, and the
React Compiler memoization note:
[context-split-value-api.md](context-split-value-api.md)

## Per-rule references

| Whenever you deal with a...                | Read                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| exporting a context to consumers           | [context-provider-hook-shape.md](context-provider-hook-shape.md)       |
| context mixing values and update functions | [context-split-value-api.md](context-split-value-api.md)               |
