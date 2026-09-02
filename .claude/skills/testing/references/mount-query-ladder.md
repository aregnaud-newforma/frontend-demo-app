---
title: Query by Role or Label; Fix the Markup Before Reaching Lower
impact: HIGH
impactDescription: the test finds what a user finds, and the component becomes accessible on the way
tags: mount, queries, accessibility, data-testid
---

## Query by Role or Label; Fix the Markup Before Reaching Lower

A node found by role or label is found the way a user finds it, and the query survives a refactor of the markup. Every query takes the highest rung it can, in this order — the eight queries Testing Library exposes, in the priority its own docs give them:

| Rung | Query                   | Finds                                                            | Reach for it when                                                          |
| ---- | ----------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1    | `getByRole`             | anything with an ARIA role, by its accessible name               | a control, a heading, a landmark, a link, an alert, a group — first, always |
| 2    | `getByLabelText`        | a form field by its `<label>`, `aria-label` or `aria-labelledby` | an input, select or textarea; the role rung needs a name it lacks          |
| 3    | `getByPlaceholderText`  | an input by its placeholder                                      | a field with a placeholder and no label — which is itself a finding        |
| 4    | `getByText`             | a node by the text the user reads                                | a message, a value, a paragraph — content, never a control                 |
| 5    | `getByDisplayValue`     | an input, select or textarea by its current value                | almost never: a value is asserted with `toHaveValue`, not queried          |
| 6    | `getByAltText`          | an `<img>` or `<area>` by its `alt`                              | an image the user identifies by what it shows                              |
| 7    | `getByTitle`            | a node by its `title` attribute                                  | almost never: a title is a tooltip, not a name                             |
| 8    | `getByTestId`           | a node by `data-testid`                                          | the last rung, and the only one that means nothing to a user              |

Each rung exists as `getBy*`, `findBy*` and `queryBy*`; the rung is chosen once, the flavour follows the moment — [mount-retrying-assertions.md](mount-retrying-assertions.md).

Landing on rung 7 or 8, or on rung 3 or 4 for a control, is a finding about the **component**: it is missing the role, the label or the element semantics a user needs. The first move is the component; the query follows.

**Incorrect (the test reaches for a handle nobody sees):**

```tsx
// component
<div data-testid="save-button" onClick={save}>Save</div>
<span className="error">{message}</span>

// test
await user.click(screen.getByTestId("save-button"));
expect(screen.getByText("Name is required")).toBeVisible(); // any span would do
```

**Correct (the component gains its semantics, the query takes the top rung):**

```tsx
// component
<button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save"}</button>
<p id={`${name}-error`} role="alert">{message}</p>
<input aria-invalid={Boolean(message)} aria-describedby={`${name}-error`} />

// test
saveButton: () => screen.getByRole("button", { name: "Save" }),
errorBanner: () => screen.getByRole("alert"),
```

`getByText` is right for **what the user reads** — a validation message, a value on a summary — and wrong for a control. A summary value is best found paired with its term: `getByRole("group", { name: "Phone" })` over a `<dl>` row that names itself, rather than a bare text match that would pass with the values under the wrong labels.
