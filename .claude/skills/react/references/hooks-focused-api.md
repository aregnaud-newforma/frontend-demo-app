---
title: Design Hooks Around One Use Case
impact: MEDIUM
impactDescription: keeps calling code declarative and APIs constrained
tags: hooks, api-design, naming
---

## Design Hooks Around One Use Case

Name each custom hook after its concrete purpose and expose only what that purpose needs. The narrower the surface, the more declarative the calling code. A hook whose API does not constrain its use cases — a god hook — couples every caller to everything it does.

**Incorrect (one hook doing fetching, auth, routing, theming):**

```tsx
const { data, login, navigate, theme } = useApp()
```

**Correct (focused, named after their purpose):**

```tsx
useChatRoom({ serverUrl, roomId })
useImpressionLog('visit_chat', { roomId })
```

Two corollaries:

- Do not extract a hook for every small bit of duplication — wrapping a single `useState` call in `useFormInput` adds indirection, not value.
- Do not prefix pure helpers with `use`. A function that calls no hooks (`formatCurrency`, `sumPrices`) is a regular function.

Reference: [Reusing logic with custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks#custom-hooks-let-you-share-stateful-logic-not-state-itself)
