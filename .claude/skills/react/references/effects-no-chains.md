---
title: Do Not Chain Effects That Set State
impact: MEDIUM
impactDescription: avoids cascading render passes
tags: effects, useEffect, state, dependencies
---

## Do Not Chain Effects That Set State

When one effect sets state that triggers another effect, each link in the chain forces a full render pass. Move the cascade into the event handler that started it, and derive what can be derived during render.

**Incorrect (three effects, three extra render passes):**

```tsx
useEffect(() => {
  setCity('')
}, [country])

useEffect(() => {
  setDistrict('')
}, [city])

useEffect(() => {
  setShippingCost(calculate(country, city, district))
}, [country, city, district])
```

**Correct (one handler, one render, cost derived):**

```tsx
function handleCountryChange(newCountry: string) {
  setCountry(newCountry)
  setCity('')
  setDistrict('')
}

const shippingCost =
  country && city && district ? calculateShipping(country, city, district) : 0
```

This differs from splitting combined hooks: there the tasks are independent and should be separated; here the updates are one logical transition and belong together in the handler.

Reference: [Chains of computations](https://react.dev/learn/you-might-not-need-an-effect#chains-of-computations)
