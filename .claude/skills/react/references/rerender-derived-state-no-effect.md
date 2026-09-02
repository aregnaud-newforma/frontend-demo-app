---
title: Calculate Derived State During Rendering
impact: MEDIUM
impactDescription: avoids redundant renders and state drift
tags: rerender, derived-state, useEffect, state
---

## Calculate Derived State During Rendering

If a value can be computed from current props/state, do not store it in state or update it in an effect. Derive it during render to avoid extra renders and state drift. Do not set state in effects solely in response to prop changes; prefer derived values or keyed resets instead.

**Incorrect (redundant state and effect):**

```tsx
function Form() {
  const [firstName, setFirstName] = useState('First')
  const [lastName, setLastName] = useState('Last')
  const [fullName, setFullName] = useState('')

  useEffect(() => {
    setFullName(firstName + ' ' + lastName)
  }, [firstName, lastName])

  return <p>{fullName}</p>
}
```

**Correct (derive during render):**

```tsx
function Form() {
  const [firstName, setFirstName] = useState('First')
  const [lastName, setLastName] = useState('Last')
  const fullName = firstName + ' ' + lastName

  return <p>{fullName}</p>
}
```

The same rule applies to defaults derived from server state. Do not copy query data into local state with an effect — the UI renders wrong once before the effect fires, and the copy silently disagrees with the source on every refetch. Store only the user's explicit choice, and derive the default with `??`.

**Incorrect (effect copies server state into local state):**

```tsx
function UserPicker() {
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: fetchUsers })
  const [selection, setSelection] = useState<User>()

  useEffect(() => {
    if (users?.[0]) setSelection(users[0])
  }, [users])
}
```

**Correct (state holds only the user's choice, default derived at render):**

```tsx
function UserPicker() {
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: fetchUsers })
  const [selection, setSelection] = useState<User>()

  const derivedSelection = selection ?? users?.[0]
}
```

References: [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
