---
title: Use useReducer When State Transitions Are Interdependent
impact: MEDIUM
impactDescription: guarantees valid state combinations
tags: state, useReducer, useState, transitions
---

## Use useReducer When State Transitions Are Interdependent

`useState` fits independent pieces of state. When several pieces must change together as one transition (loading + error + data), separate setters can be half-applied — a reducer makes each transition atomic and each valid combination explicit.

**Incorrect (three setters you can forget to coordinate):**

```tsx
setIsLoading(false)
setError(null)
setPost(data)
```

**Correct (one dispatch, one guaranteed valid state):**

```tsx
type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: Post }
  | { type: 'FETCH_ERROR'; error: Error }

dispatch({ type: 'FETCH_SUCCESS', payload: data })
```

The reducer is the single place transitions are defined, so an impossible combination (`loading` with `data`) has nowhere to come from.

Reference: [Extracting state logic into a reducer](https://react.dev/learn/extracting-state-logic-into-a-reducer)
