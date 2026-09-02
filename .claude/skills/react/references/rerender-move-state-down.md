---
title: Move State Down to Where It Is Used
impact: HIGH
impactDescription: stops state changes from re-rendering unrelated siblings
tags: rerender, colocation, state, optimization
---

## Move State Down to Where It Is Used

State declared in a component re-renders everything that component returns. When only a small part of the tree uses the state, extract that part into its own component and move the state into it — the expensive siblings stop re-rendering entirely, with no memoization.

**Incorrect (every keypress on the dialog re-renders VerySlowComponent):**

```tsx
function App() {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div className="layout">
      <Button onClick={() => setIsOpen(true)}>Open dialog</Button>
      {isOpen ? <ModalDialog onClose={() => setIsOpen(false)} /> : null}
      <VerySlowComponent />
    </div>
  )
}
```

**Correct (state scoped to the components that use it):**

```tsx
function ButtonWithModalDialog() {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Open dialog</Button>
      {isOpen ? <ModalDialog onClose={() => setIsOpen(false)} /> : null}
    </>
  )
}

function App() {
  return (
    <div className="layout">
      <ButtonWithModalDialog />
      <VerySlowComponent /> {/* no longer re-renders when the dialog toggles */}
    </div>
  )
}
```

This is the first tool to reach for on any re-render problem — before `memo`, before context surgery. Corollary: never lift state higher than necessary, and keep transient state (form fields, hover) out of global stores.

Reference: [Before you memo()](https://overreacted.io/before-you-memo/)
