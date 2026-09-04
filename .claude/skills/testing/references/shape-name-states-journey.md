---
title: The Name States the Journey, Not the Assertion
impact: LOW
impactDescription: a failure reads as what the user lost
tags: shape, naming
---

## The Name States the Journey, Not the Assertion

A name is what the runner prints on red. "disables save" says which matcher failed; "edits every field, saves, and lands on the summary" says which journey the user can no longer run. Name the arrival for a default render, the journey for the rest, in the user's terms.

**Incorrect (the assertion, or the implementation):**

```tsx
it("isLoading true", ...);
it("calls onChange", ...);
it("PhoneField", ...);
```

**Correct (what the user sees or does):**

```tsx
it("shows a loading state, then every field seeded from the stored account", ...);
it("emits the number in E.164 once it is complete", ...);
it("keeps the form and shows the error when the save is refused", ...);
```

A unit test names the input class and the value out — "rejects a number missing its leading zero as invalid_prefix" — see `unit.md`.
