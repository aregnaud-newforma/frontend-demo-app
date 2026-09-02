## Mounting

Two mounts, one per integration level, both under `AppProviders` — the
composition root mirroring `main.tsx` — and both a thin wrapper over Testing
Library's `render`:

- **`renderRoute(path)`** from `@testing/render-route` — the page mount. It
  builds the app's own route tree over a memory history, so the test crosses
  the routing, the params and the navigation the user crosses. A page is never
  rendered as a bare component: a save that navigates would go nowhere.
- **`renderComponent(ui)`** from `@testing/render-component` — the component
  mount. One component, its props, no router.

Neither returns anything to query. Queries come from `screen` and `within` of
`@testing-library/react`; actions come from a `userEvent.setup()` made before
the mount.

## The setup function

Every integration file has one function named **`render<ComponentName>`** —
`renderEditAccountPage`, `renderPhoneField` — that calls the mount and hands back
queries and actions, so the test body reads as prose and no raw query sits in
it. [mount-setup-function.md](mount-setup-function.md) holds the shape:

- **Queries as functions** — `savingButton: () => screen.getByRole(...)` — a
  `getBy*` throws the moment it runs, so a node absent at mount must not be
  queried until the journey reaches it.
- **The flavour chosen per entry** — `getBy*` for a node on screen, `findBy*`
  for one that arrives after a fetch or a navigation, `queryBy*` for one the
  test asserts absent.
- **An argument where the query varies** — `fieldError(message)`,
  `summaryValue(term)`.
- **Actions as verbs** — `changeName(value)`, `saveForm()` — wrapping
  `user.type`, `user.click`, `user.selectOptions`.

A component setup adds two things: **props as arguments with defaults**, and the
**callback it hands back** so the test asserts what the component emitted — the
same rule file, second half.

## The query ladder

Every query takes the highest rung it can: **role**, then **label**, then
placeholder, text, display value, alt text, title, and `data-testid` last — the
only rung that means nothing to a user. The full table, one row per query, is in
[mount-query-ladder.md](mount-query-ladder.md).

Landing low is a finding about the **component**: give the node its role, its
label, its element semantics first, then query it.

A role's `name` and a text matcher match the **whole** string by default, so
"Your account" does not match "Edit your account" and no `exact` flag is
needed. What remains is the same name in two regions — a link in the nav and in
the body — which `getBy*` refuses with a "found multiple elements" error, and
which is scoped with `within(landmark)`. [mount-exact-names.md](mount-exact-names.md)

## Assertions retry through the query

`getBy*` never retries; `findBy*` polls the DOM until the node is there. So
**`expect(await screen.findByRole(...)).toBeVisible()`** is the whole story for
something that arrives later, `waitForElementToBeRemoved` is the story for
something that leaves, and `waitFor` is reserved for what is not a query
result. No sleep, and no retry nested inside another.
[mount-retrying-assertions.md](mount-retrying-assertions.md)

## Per-rule references

| Whenever you deal with a...                                       | Read                                                                       |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| test body holding `screen.getBy*` directly                        | [mount-setup-function.md](mount-setup-function.md)                         |
| component test, its props and its `onChange`                      | [mount-setup-function.md](mount-setup-function.md), second half            |
| `data-testid`, `getByText` for a control, a CSS selector          | [mount-query-ladder.md](mount-query-ladder.md)                             |
| query failing on two matches, or the same name in two regions     | [mount-exact-names.md](mount-exact-names.md)                               |
| `setTimeout`, a `waitFor` around a `findBy*`, a `getBy*` too early | [mount-retrying-assertions.md](mount-retrying-assertions.md)               |
