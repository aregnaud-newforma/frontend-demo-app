## The Network Is the Only Seam

An integration test substitutes **one** thing: HTTP, at msw. The router, the
query client, the hooks, the child components, the stores and the helpers all
run for real. The server is already listening in `vitest.setup.ts` and errors
on any `/api/*` request nobody handles — a journey reaching an endpoint without
a handler fails, which is the point.

Before writing `vi.mock`, `vi.fn` or `vi.spyOn`, find the row:

| What you were about to mock                                              | What to write instead                                                              |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| The API client, a `fetch` wrapper, a helper in `helpers/api.ts`          | An msw handler on the endpoint it calls — [seam-msw-over-module-mock.md](seam-msw-over-module-mock.md) |
| A hook, a child component, a store, a helper of the feature              | Nothing: the real one runs, the handler feeds it — [seam-real-collaborators.md](seam-real-collaborators.md) |
| A platform API jsdom lacks — `matchMedia`, `ResizeObserver`, layout      | A polyfill or a stub in `vitest.setup.ts`, once for the suite; never a `vi.mock` in a test |
| A runtime the test cannot reach — feature flags, analytics               | A provider in `@testing/app-providers`, the one substitution beside the network     |
| Branch-heavy logic the journey only passes through                       | A unit test on that module; the journey keeps the real one                          |
| The clock — `Date.now()`, timers, a debounce                             | `vi.useFakeTimers()`: the clock faked, the module real — [seam-fake-clock.md](seam-fake-clock.md) |
| A callback prop of a component under `renderComponent`                   | `vi.fn()` is right here — it is the collaborator the contract hands back            |

## Where a handler lives

- **The shared set** — `<vertical>/mocks/handlers.ts` holds the happy-path
  answer every journey can live with, over the `@msw/data` store in `mocks/db.ts`.
  The server listens on it.
- **The journey's own answer** — `server.use(...)` in the test body, for the
  fixture, the refusal or the held answer that journey turns on. It wins over
  the shared set until `afterEach` resets it.
  [seam-per-journey-handlers.md](seam-per-journey-handlers.md)

Three kinds of answer a journey writes:

- **A refusal** — `HttpResponse.json({ message }, { status: 500 })`, for the
  edge case that asserts what the user sees when the server says no.
- **A round-trip** — a journey that writes then reads back what it wrote goes
  through the store, so the test can end on what the backend holds.
  [seam-store-round-trip.md](seam-store-round-trip.md)
- **A held answer** — the request stays open until the test releases it, so an
  in-flight assertion lands where the test puts it, never on a timer.
  [seam-held-answer.md](seam-held-answer.md)

## Per-rule references

| Whenever you deal with a...                                    | Read                                                                   |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `vi.mock` on the API client or a fetch helper                  | [seam-msw-over-module-mock.md](seam-msw-over-module-mock.md)           |
| `vi.mock` on a hook, child component, store or helper          | [seam-real-collaborators.md](seam-real-collaborators.md)               |
| answer only one test needs — a fixture, a 500, a slow reply    | [seam-per-journey-handlers.md](seam-per-journey-handlers.md)           |
| spinner, disabled button, skeleton — any in-flight state       | [seam-held-answer.md](seam-held-answer.md)                             |
| save that should persist, or should send nothing               | [seam-store-round-trip.md](seam-store-round-trip.md)                   |
| debounce, animation, `Date.now()`, `setTimeout`                | [seam-fake-clock.md](seam-fake-clock.md)                               |
