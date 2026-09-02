# The shape

Every rule a merged test follows, whatever it merges and whichever level it lands at.

Every rule below binds to a level — the four are in [`levels.md`](levels.md). A merged test
follows the rules for its own level **and every broader scope that contains it**. This file
names the APIs a merged test uses; the dialect supplies them.

## Every merged test

- **Isolation.** Each test sets up its own state in its own body, depends on no other test,
  and passes whatever order it runs in. No state survives from one test to the next.

## Journeys — E2E and integration

A journey drives the app the way a user does and asserts what they see. These rules hold at
E2E and both integration levels — every merged test but the page's **default render**, which
drives nothing and takes its own rules in _Integration page only_ below.

- **Fewer, longer tests** A test covers its whole flow at its level — the full journey
  for E2E, the full page for Integration page, the component's whole interaction for a
  component — every step and state (loading, in-flight, validation, result) asserted where it
  happens.
- **`// Use case: <use case> — Happy path` above every journey `it`** — the **Use case** and
  the **Kind** from its row in the approved plan, `Edge case` where the row says so: what the
  user came to do, and which of its level's jobs this test does for it. A file holding
  several tests of one use case repeats the use case on each, so a test read alone still says
  whose journey it belongs to.
- **Given / When / Then** marking where one leg of the journey ends and the next begins.
- **A name that states the journey** — "loads a profile, renames it, and returns to the
  summary". Merged tests need new names: the old ones each described a single assertion.
- **One journey per test.** A journey that needs a second, different setup — a different
  seed, a different route — is a new `it`, and each `it` keeps its own single setup. A
  mid-test `cleanup()` is the tell that one name is doing two tests' work: split it.
- **Inline setup.** The setup helper is shared across tests; the call to it is not — each
  merged test invokes its own setup in its own body. Merging is when hoisting into a
  `beforeEach` looks like a simplification; it reintroduces the shared state the merge just
  removed. Fake timers are the exception: it goes in a `beforeEach`, with real timer in the matching `afterEach`.
  The clock is runner state rather than test state, and it has to be faked before the body
  runs so the mount in that body never sees the real one.
- **Flat file.** Merged tests sit at the top level. One journey per test is already the
  grouping, so a `describe` wrapper adds a layer without a distinction.

## E2E only

An E2E row lands in the repo's e2e directory, and that directory is the authority on how:
it already carries its own runner, its own naming, and — where the project has them — its
own screen objects and helpers. Read it before writing, and follow what it does.

- **The whole journey, against the real API.** No `msw`, no seeded store, no factory standing
  in for the backend. The seam an integration test puts at HTTP is the one thing an E2E row
  exists to cross, so where a fixture is needed the journey creates it the way a user does,
  through the app.
- **Actions through the directory's own objects.** Where a screen or page object exists, the
  journey calls its verbs. Where a step has no method for what the user does, the merge adds
  one to that object rather than putting a raw selector in the journey — the same rule
  `render<ComponentName>` carries at the integration levels, one directory up.
- **Happy paths only.** [`levels.md`](levels.md) gives E2E no edge cases: an edge case that reaches
  this level is a plan row to send back to integration, named in the recap.

## Integration — page and component

An integration test mounts one page or component and drives it, substituting only the
network. Both integration levels share the rules here; the component level adds a few more in
the next section.

- **A block comment naming the level, directly below the imports** — `page` or `component`,
  the level of the table the file's rows came from in the approved plan:

  ```tsx
  /*
   * Integration: page
   */
  ```

  The two levels share the `*.integration.test.*` suffix and are told apart only by
  directory, so the block spells the level out where the filename cannot.

- **A setup function named `render<ComponentName>`** — the page or component under test,
  spelled as the file spells it: `renderProfilePage()` for `ProfilePage`, `renderPhoneField()`
  for `PhoneField`. It returns ready-to-run locators and actions, so the journey reads as
  prose. A page or the screen it mounts goes through `renderScreen`, a component through
  `renderComponent` — the two mounts [`setup.md`](../setup.md) wrote, one per level. It hands
  back:
  - **A name for what the user sees** — `savingButton`, `errorBanner` — so the assertion says
    what the user is looking at rather than how it was found.
  - **An argument where the query varies** — `fieldError(message)`, `summaryValue(value)` —
    one entry covering every message that field can carry.
  - **Actions as verbs** — `changeName`, `saveForm` — each wrapping the interaction the
    dialect's action API gives.

- **The network as the only seam.** An integration test substitutes one thing: HTTP, at
  `msw`. The router, the query client, the hooks, the child components, the stores and the
  translations all run for real. [`msw.md`](msw.md) holds how a journey writes its own
  handlers — the fixture it reads, the refusal it survives, the store it round-trips through,
  and the answer it **holds** to assert an in-flight state.

  Every module mock the scaffolding left is a finding, and each resolves to exactly one row:

  | What the mock stands in for                                                       | What it becomes                                                                              |
  | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
  | A module the journey fetches through — API client, `fetch` wrapper, SDK           | An `msw` handler on the endpoint it calls                                                    |
  | A hook, a child component, a store, a util of the feature                         | Deleted: the real one runs, and the handler feeds it                                         |
  | A platform API the test environment lacks — media queries, observers              | A polyfill in the setup file the runner names, once for the whole suite                      |
  | A native module the environment has no engine for — haptics, camera, image picker | A double beside the repo's other doubles, written the run a journey first crashes without it |
  | A runtime the test cannot reach — feature flags, analytics, federated remotes     | A provider in `AppProviders`: the one substitution beside the network                        |
  | Branch-heavy logic the journey only passes through                                | A unit test on that module; the journey keeps the real one                                   |
  | The clock — `Date.now()`, timers                                                  | The runner's fake timers: the clock faked, the module real                                   |

  A merged file's substitutions end as its `msw` handlers, the setup file's polyfills, and
  the providers `AppProviders` names. A module mock that survives is named in the recap with
  the row that kept it.

- **Factory data.** One fixture has to satisfy the whole journey, not just one assertion.
  Build it with the feature's **Fishery** factory — `Factory.define<T>`, exported as
  `<name>Factory`, faker underneath — overriding only the field the journey turns on:
  `profileFactory.build({ phone: null })` for the missing-phone case.

- **Query by priority.** Every assertion reaches its node by the highest rung the dialect's
  ladder allows, not the first one that works. Landing below the rungs a user could have used
  is a finding about the component, not about the test: **the first move is the component**,
  and the edit is the query handle the dialect names — its accessibility markup, or the
  `testID` a native component is missing. Conditions, handlers, state and render paths stay
  exactly as they are: a merge that changes behaviour is no longer a merge.

  This is the one edit to shipped source a merge makes, and no plan row carries it, so
  **every component touched is named in the recap** with the handle it gained.

- **Interact through the action API.** Every action goes through the dialect's `userEvent`:
  set it up in the setup function and return it, then await every call. It fires the whole
  sequence a real interaction produces, where a raw event fires one. `fireEvent` covers what
  no user does by hand.

## Integration page only

A page's file opens on **the default render** — one `it` asserting everything the user sees
once the page has finished loading, and nothing else: the fields and the values they arrive
with, the data the page fetched, what is enabled and what is not, what is absent. It is the
arrival state the rest of the file starts from.

- **`// Use case: <use case> — Default render` above it** — the third value the plan's **Kind**
  column carries, beside `Happy path` and `Edge case`.
- **A name that states the arrival** — "shows an empty report form dated today".
- **Given / Then**, marking the mount and what it renders. There is no When: nothing is done
  to the page.
- **The journeys act.** Every other `it` in the file drives the page and asserts what its own
  actions change, starting from the arrival state rather than restating it. An assertion
  about what the page arrives with belongs here, made once, at the top of the file.

**One per distinct arrival** — normally one for the whole file. A use case reaching the page
on a different route or a different seed arrives somewhere else and earns its own `it`; use
cases arriving the same way share one.

## Integration component only

A component test mounts the component alone, with the props the journey turns on, and returns
the same shape as a page setup with two additions:

- **Takes the props as arguments, each with a default**, so a test names only the prop its
  case turns on — `renderPhoneField({ value: "+33" })` — and the rest stay ordinary.
- **Returns the collaborator the component calls back into.** `onChange` comes back so the
  journey can assert what the component handed out, the component's half of its contract.

## Unit only

A unit file proves a branch-heavy or shared symbol on its own terms: it calls the module
directly, with no mount, no seam.

- **One `it` per input class** — each accepted shape, each rejection reason, each boundary
  the symbol distinguishes.
- **A name in the developer's terms** — "rejects a number whose country code is unknown",
  "returns null for an empty string": the input class in, the value out.
- **A table is for one class, many values.** Use `it.each` only when every row runs the
  same act and the same assertion, and only the value changes: the country codes the parser
  rejects, the strings that trim to empty. The row _is_ the value, and the name interpolates
  it:
  ```javascript
  it.each([
    ["a", "b", "c"],
    ["d", "e", "f"],
  ])("%s and %s give %s", (first, second, expected) => {
    ...
  });

  it.each([
    { a: 1, b: 1, expected: 2 },
    { a: 1, b: 2, expected: 3 },
    { a: 2, b: 1, expected: 3 },
  ])("$a + $b returns $expected", ({ a, b, expected }) => {
    ...
  });
  ```
  A row carrying a description of itself is the tell that the rows are separate tests:
  `["an empty bio is accepted", { bio: "" }]` and
  `["an empty telephone is accepted", { telephone: "" }]` are two input classes, not two
  rows. Each is its own `it`, read on its own, named in the developer's terms — as is any row
  that sets a different property from its neighbours.
- **Arrange / Act / Assert** — the three phases marked as comments.
