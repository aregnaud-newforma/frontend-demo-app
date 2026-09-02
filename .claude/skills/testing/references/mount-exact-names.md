---
title: Scope a Name That Appears Twice; Matching Is Already Exact
impact: MEDIUM
impactDescription: a query that matches one node instead of failing on two, or matching too much
tags: mount, queries, within, landmark, regex
---

## Scope a Name That Appears Twice; Matching Is Already Exact

A role's `name`, a label and a text matcher given as a string match the **whole** string, case-sensitive, whitespace collapsed. "Your account" does not match "Edit your account", "Name" does not match "First name", and no `exact` flag is needed — `ByRoleOptions` does not even have one. Two things remain:

- **The same name in two regions.** A link the nav and the body both carry is two nodes, and `getBy*` refuses it with "Found multiple elements". The fix is the landmark: `within(region).getByRole(...)`.
- **A name with a dynamic part.** A row named after its subject, a heading holding a count, take a regex — anchored, so it stays exact on the part that is fixed.

**Incorrect (widening the match to make a query pass):**

```tsx
accountHeading: () => screen.getByRole("heading", { name: /account/i }),      // also "Edit your account"
accountLink: () => screen.getAllByRole("link", { name: "Your account" })[0],   // whichever comes first
nameInput: () => screen.getByLabelText("Name", { exact: false }),              // also "First name"
```

**Correct (a landmark around a repeated link, an anchored regex around a variable part):**

```tsx
accountHeading: () => screen.getByRole("heading", { name: "Your account" }),
accountLink: () =>
  within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Your account" }),
invoiceRow: (number: number) => screen.getByRole("row", { name: new RegExp(`^Invoice #${number}$`) }),
```

A "Found multiple elements" error is a finding about the query, not a reason for `getAllBy*` and an index: name the region the user is looking at. A comment beside the query saying which collision it avoids saves the next reader the search.
