---
title: Store Identifiers, Not Copies of Objects
impact: MEDIUM
impactDescription: prevents state desynchronization
tags: state, duplication, selection
---

## Store Identifiers, Not Copies of Objects

When the same data lives in two state variables, updating one silently desynchronizes the other. Store the identifier and look the object up during render.

**Incorrect (selectedItem is a stale copy after items changes):**

```tsx
function Menu({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems)
  const [selectedItem, setSelectedItem] = useState(items[0])
  // editing an item's title in `items` leaves `selectedItem` with the old title
}
```

**Correct (one source of truth, selection derived):**

```tsx
function Menu({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems)
  const [selectedId, setSelectedId] = useState(initialItems[0]?.id)

  const selectedItem = items.find((item) => item.id === selectedId)
}
```

Reference: [Avoid duplication in state](https://react.dev/learn/choosing-the-state-structure#avoid-duplication-in-state)
