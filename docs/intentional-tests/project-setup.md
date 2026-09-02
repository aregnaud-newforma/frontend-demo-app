# Intentional tests: project setup

Settled 2026-08-25. What every later run of the `intentional-tests` skill reads instead of
resolving any of this again.

## Dialect

**Web, Vitest Browser Mode variant.** `references/dialect-web.md` is the file to read, with
three deviations this repo makes, all deliberate and all documented in the config that makes
them:

| Slot       | `dialect-web.md` says                                 | This repo                                                                                                                                          |
| ---------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mount      | `@testing-library/react` under `environment: "jsdom"` | `vitest-browser-react`, real headless Chromium via `@vitest/browser-playwright`                                                                    |
| Actions    | `userEvent` from `@testing-library/user-event`        | `userEvent` from `@vitest/browser/context`, shipped with Browser Mode                                                                              |
| Seam entry | `msw/node` (`setupServer`)                            | `msw/browser` (`setupWorker`) — the tests run _in_ the browser, so requests are intercepted by the Service Worker in `public/mockServiceWorker.js` |
| Assertions | `expect(el).toBeVisible()`, `findBy*`                 | `await expect.element(locator).toBeVisible()` — locators retry, so there is no `findBy*` half                                                      |

The query ladder, the `renderScreen` / `renderComponent` split and every rule in
`references/shape.md` hold unchanged.

## Testing rules swept

Read: `AGENTS.md` (`## Tests`), `CLAUDE.md` (which is one line pointing at `AGENTS.md`),
`.claude/skills/` (engineer, javascript, react, typescript — none states a testing rule),
`skills-old/prune-tests/SKILL.md`.

**No conflicts, nothing cut.** `AGENTS.md` states that a test's filename decides its tier,
which is what the runner already enforces. `skills-old/prune-tests/` is a superseded
predecessor of this skill, sits outside `.claude/skills/` so it is never loaded, and says the
same things anyway.

## Package roles

Every role filled by what the repo already had. **Nothing installed.**

| Role      | Package                                                                   |
| --------- | ------------------------------------------------------------------------- |
| Mount     | `vitest-browser-react`                                                    |
| Actions   | `@vitest/browser/context` (inside `vitest`/`@vitest/browser-playwright`)  |
| Fake data | `@faker-js/faker`, with `enforce-unique` for values that must not collide |
| Fixtures  | `fishery`                                                                 |
| API seam  | `msw`                                                                     |
| Store     | `@msw/data` + `zod`                                                       |

## Runner

**Routed.** `vitest.config.ts` already carried one project per level; this run added the
script per level.

| Level       | Pattern                                                 | Command                                               |
| ----------- | ------------------------------------------------------- | ----------------------------------------------------- |
| unit        | `src/**/*.unit.test.{ts,tsx}`, `environment: "node"`    | `yarn test:unit`                                      |
| integration | `src/**/*.integration.test.{ts,tsx}`, headless Chromium | `yarn test:integration`                               |
| e2e         | `e2e/*.spec.ts`                                         | `yarn e2e` (Playwright, outside both Vitest projects) |

`yarn test` still runs unit + integration together. Coverage is a root option over both
projects — one set of numbers over `src/`, which is the only reading that means anything.

## The seam

- **Worker**: `src/testing/worker.ts` — `setupWorker(...handlers)` from `msw/browser`.
- **Lifecycle**: `vitest.setup.ts` — start in `beforeAll`, `resetHandlers()` + `accounts.clear()`
  in `afterEach`, `stop()` in `afterAll`. The `onUnhandledRequest: "error"` equivalent is a
  callback that errors only on `/api/*`, because every other request on that origin is Vite
  serving modules to the runner.
- **Handlers per feature**: `src/account/mocks/handlers.ts` (`ACCOUNT_URL = "/api/account"`,
  GET + PUT over the store). `home/` and `layout/` have no handlers module and need none —
  neither runs a query.
- **Store**: `src/account/mocks/db.ts` — an `@msw/data` `Collection` under a Zod schema.
- **Held answers**: `src/testing/deferred.ts`, added by this run. Hand-rolled because
  `tsconfig.json` targets ES2021, so `Promise.withResolvers` is not declared; when that `lib`
  moves to ES2024 the file goes.

## The shared mount

`src/testing/`, all three added or already present:

- **`renderRoute(path)`** in `render-route.tsx` — the Integration **page** mount, kept under
  its existing name (five test files import it) rather than renamed to `renderScreen`. It
  builds a fresh router over the app's own `routeTree` on a memory history.
- **`renderComponent(ui)`** in `render-component.tsx` — the Integration **component** mount,
  added by this run. One component under `AppProviders`, no router.
- **`AppProviders`** in `app-providers.tsx` — added by this run. Holds `QueryClientProvider`
  over a per-mount `createQueryClient()`, and nothing else, because that is all `main.tsx`
  wraps `<App />` in.

**Follow-up (drift):** `AppProviders` _mirrors_ `main.tsx` rather than being imported from it —
the entry composes its providers inline, so there is nothing to import, and extracting it is
the developer's change, not this skill's. A provider added to `main.tsx` and not to
`app-providers.tsx` lands as a crash or a blank render in whichever test first mounts the
component that consumes it.

The two existing component tests (`FieldError`, `SummaryRow`) still call `render()` from
`vitest-browser-react` bare; moving them onto `renderComponent` is a merge, not setup.

## What E2E needs before it can run

`yarn e2e` is `playwright test` against `http://localhost:4173`, and it is dead without two
processes, which `playwright.config.ts` starts itself:

1. **The real account API** — `yarn api:start` (`node --experimental-strip-types server/api.ts`)
   on `:3001`, waited on at `/health`, 30s timeout.
2. **The production bundle** — `yarn build && yarn preview` on `:4173`, 120s timeout. The
   preview server proxies `/api` to `:3001`.

Nothing is intercepted at this level: the specs seed the real API and read back from it.
`reuseExistingServer` is on outside CI, so a `yarn dev`-style pair left running is picked up
instead of rebuilt. Chromium comes from `yarn browsers:install`, once per machine. Budget the
build: a cold `yarn e2e` pays the full `yarn build` before the first assertion.

## Verified

`yarn verify` green, `yarn test:unit` 68 passed, `yarn test:integration` 88 passed, after the
files above landed.
