---
title: Reset State with the key Prop, Not an Effect
impact: MEDIUM
impactDescription: avoids an extra render pass and stale UI on prop change
tags: effects, state, key, reset
---

## Reset State with the key Prop, Not an Effect

To reset a component's state when a prop changes, do not clear it in an effect. The component renders once with stale state, then again after the effect fires. Pass a `key` instead: React unmounts and remounts the component with fresh state, in a single pass.

**Incorrect (renders with stale state first, then resets):**

```tsx
function ProfilePage({ userId }: { userId: string }) {
  const [comment, setComment] = useState('')

  useEffect(() => {
    setComment('')
  }, [userId])

  return <CommentField value={comment} onChange={setComment} />
}
```

**Correct (fresh state on every userId, no effect):**

```tsx
function ProfilePage({ userId }: { userId: string }) {
  return <Profile key={userId} userId={userId} />
}

function Profile({ userId }: { userId: string }) {
  const [comment, setComment] = useState('')
  return <CommentField value={comment} onChange={setComment} />
}
```

Every piece of state inside the keyed component resets at once — no field can be forgotten.

Reference: [Resetting all state when a prop changes](https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes)
