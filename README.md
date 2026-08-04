# Account form - testing pyramid example

A practical, runnable illustration of the testing strategy on a single feature
(a user account form), one test file per level of the pyramid.

The form **loads** the account on mount and **saves** it on submit. Two round
trips rather than one is deliberate: a read-then-write feature is where the
levels of the pyramid actually start to differ, because there is now a component
that is not interactive yet, a server response that has to be mapped back into
the fields, and a stored record to check the write against.

| Level       | Tool                                                                 | File                                                         | Covers                                                                                                                                           |
| ----------- | -------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit        | Vitest (Node)                                                        | `src/account/__tests__/phone.unit.test.ts`                   | One reusable, logic-heavy pure function (French phone parser), every branch                                                                      |
| Integration | Vitest Browser Mode + vitest-browser-react + MSW + @msw/data + Faker | `src/account/__tests__/EditAccountPage.integration.test.tsx` | Both round trips and their edges (load, loading state, failed load, save, validation, failed save, saving state)                                 |
| Integration | same                                                                 | `src/account/__tests__/AccountPage.integration.test.tsx`     | The read-only route: shared formatting, empty optional fields, failed load, the link to the form                                                 |
| Integration | same                                                                 | `src/home/__tests__/HomePage.integration.test.tsx`           | The landing route: that "/" renders rather than forwarding, and the way out of it                                                                |
| Integration | same                                                                 | `src/layout/__tests__/Navigation.integration.test.tsx`       | The shell's nav: both destinations, from more than one route, and the `aria-current` that says where you are                                     |
| E2E         | Playwright                                                           | `e2e/account.spec.ts`                                        | Happy path only (arrive, navigate, read, edit, save, return), real browser + production build                                                    |
| E2E         | same                                                                 | `e2e/home.spec.ts`                                           | What only a real browser can show about the landing route: "/" is served, it costs zero round trips, and the back/forward buttons follow the nav |

## Three pages

The app is routed with **[TanStack Router](https://tanstack.com/router)**, so
there is a navigation to test and not only a screen:

```
/                -> the welcome
/account         -> the account, read-only, and a link to edit it
/account/edit    -> the form; on save, back to /account
```

A nav in the root layout links the first two, so every route can be reached
without the URL bar. `/` used to forward straight to `/account` for want of
anything to land on; the welcome is that something, and the redirect is gone.

The route tree is written out in `src/routes.tsx` rather than generated from
filenames - three routes read more clearly as code, and nothing generated has to
be committed and kept in sync.

**A page is a page, not a wrapper around a component.** There is no AccountForm
or AccountSummary in the middle: neither ever had a second caller, and a
component extracted for one caller only moves the code without dividing it. The
pages hold their own markup, load states included. What they share, they share
deliberately - the account query (`useAccount`), the schema, the mapping in
`api.ts`, and one small `FieldError`, which is a file of its own for a different
reason again: it holds an invariant no type can enforce, that the id it renders
is the id its `errorProps` half points `aria-describedby` at.

`Navigation` is the apparent exception and is worth being precise about, because
"one caller" is the wrong count for it: `RootLayout` is where it is written, but
every route is where it renders. It is split from the layout because the two
change for different reasons - a destination added to one, a landmark or a width
to the other - and because only one of them needs to know the route tree exists.
Both halves live in `src/layout/` rather than loose beside the entry files: the
chrome is a subject, and a subject gets a folder. Giving the nav its destinations
as props to make it generic would be an abstraction built for a single caller.

Data loading stays in the pages, in react-query, rather than moving to route
`loader`s: react-query already owns caching, revalidation and the in-flight and
error states, and a loader would hand half of that to the router.

Because the pages navigate, the integration tests mount the **real route tree**
over a memory history (`src/testing/render-route.tsx`). Testing a page that
navigates without giving it somewhere to navigate to would prove less than the
test appears to: a successful save is asserted as "back on the account page,
showing the new value" - the outcome the user actually gets.

Both routes read the **same** cache entry - through one `useAccount()` hook,
which pairs the query key with the function that fills it so the two pages
cannot drift into caching one account twice. Navigating between them paints from
cache with no second spinner while react-query revalidates in the background,
and the save writes the server's response into that entry before navigating, so
the summary is already correct on arrival.

The hook stops at the data: each page writes its own loading and failure
markup. That is duplication on purpose - three lines each, and every page stays
free to word and place them itself. Both copies are covered by their own
integration test, which is the price of keeping them.

The two Vitest levels run as separate [projects](https://vitest.dev/guide/projects)
(see `vitest.config.ts`): units in Node with no DOM at all, the component in a
real headless Chromium. The **filename suffix** decides which one a test belongs
to - `*.unit.test.ts` or `*.integration.test.tsx` - so the level is visible in
the file tree and in the runner output, and either tier can be run on its own:

```bash
yarn test --project unit          # just the fast ones
yarn test --project integration   # just the browser ones
```

`vitest-browser-react` renders the component and returns
Vitest [locators](https://vitest.dev/guide/browser/locators), so assertions are
written as `await expect.element(...)` and keep re-querying until they pass -
no `waitFor`, far less flake, and interactions go through CDP instead of
synthetic events. That matters more than usual here: nothing in the form exists
until the GET resolves, and lazy locators mean the setup function can hand back
those elements anyway. Because the tests run in a browser, MSW intercepts with a
Service Worker (`msw/browser`), not `msw/node`; the worker script in
`public/mockServiceWorker.js` is generated by the `postinstall` script.

The mock backend is **stateful** (`@msw/data`): a test seeds an account with
`seedAccount()`, the GET reads it back, and the PUT mutates it. A stubbed fetch
could fake either half; only a store proves the two agree.

The E2E tier mocks nothing at all. It runs against `server/api.ts`, a real
in-memory HTTP server in its own process, which Playwright starts alongside the
preview build (see the `webServer` array in `playwright.config.ts`). The app
calls the same-origin `/api/account` and the preview server proxies it across,
so the browser sees one origin and carries its cookies normally.

That boundary is the reason this tier is worth its cost. A stub cannot disagree
with the frontend about a status code, a header or a body shape, because it is
the frontend's own assumptions played back; two processes can. The specs seed
through the API and assert by reading back out of it, so a passing run means the
request, the storage and the response all agreed.

Because Playwright runs specs in parallel, the server keys its store by a
session id that each test generates and puts in a cookie on its own browser
context (`e2e/session.ts`). Data isolation is the problem every real E2E suite
has to solve and no mocked one ever does.

The pages hold no state of their own. Four libraries, four concerns:

- **[react-query](https://tanstack.com/query)** owns the two requests and their
  in-flight/error status. The save writes the server's response back into the
  cache, and that one line is what makes the summary correct on arrival.
- **[TanStack Form](https://tanstack.com/form)** owns the field values.
- **[TanStack Router](https://tanstack.com/router)** owns where a successful
  save leads.
- **Zod** owns the rules, handed to the form as a **Standard Schema** - which
  Zod 4 implements natively, so there is no resolver or adapter package - and so
  `src/account/helpers/validation.ts` is the only place a rule is written. The schema is
  shaped so its **input** is what the DOM can hold (including the `""` the
  language `<select>` starts on) and its **output** is what the app wants
  (`langue` narrowed to a real value) - which is why nothing downstream needs a
  cast.

None of the test _bodies_ changed as the form moved from `useState` to
react-hook-form to react-query, nor when react-hook-form was swapped out for
TanStack Form - they drive labels and roles, not the libraries underneath. That
swap rewrote the form and touched the test file not at all, which is the whole
claim this repo makes. Adding react-query changed exactly one thing: the setup
function now builds a **fresh client per test**, because a shared cache would
carry one test's account into the next.

Routing is the honest counter-example, and worth stating rather than hiding.
Moving the form onto a route that navigates on save DID change three tests -
not because the tests were brittle, but because the behaviour changed: there is
no "Changes saved." banner any more, so the assertion became "we are back on the
account page, showing the new value". A test that survives a change in what the
user sees would not have been testing much. What still held is the boundary:
every other test, and every locator, was untouched.

## The rule of thumb

Many fast unit tests, fewer integration tests, very few E2E tests. Push each
check to the lowest level that can catch the bug: branch logic in units, wiring
and states in integration, the full flow in one E2E.

## Run it

```bash
yarn install

yarn browsers:install   # one-time: download the Chromium browser
                        # (used by both Vitest Browser Mode and Playwright)

yarn test          # unit (Node) + integration (Browser Mode)
yarn e2e           # end-to-end (Playwright; starts the API and the preview build)

yarn api:start     # the account API on its own, for `yarn dev` to proxy to

yarn verify        # oxlint + oxfmt --check + tsc --noEmit, the CI gate
yarn lint          # oxlint          (--fix to apply what it can)
yarn format        # oxfmt, in place (--check to only report)
```

## The toolchain is all [Oxc](https://oxc.rs)

Three Rust tools, one parser between them:

| Job        | Tool                     | Where it is configured                                                   |
| ---------- | ------------------------ | ------------------------------------------------------------------------ |
| Bundling   | **Rolldown**, via Vite 8 | `vite.config.ts` - nothing to opt into, Vite 8 has no Rollup in its tree |
| Linting    | **oxlint**               | `.oxlintrc.json`                                                         |
| Formatting | **oxfmt**                | `.oxfmtrc.json`                                                          |

`printWidth: 100` in `.oxfmtrc.json` is not a preference so much as a
measurement: at oxfmt's default of 80 every file in the repo reflowed, at 100
only two did. The existing code was already written to that width, so the
formatter was matched to the codebase rather than the other way round.

`sortPackageJson` is off for the same reason - it is a real feature, but it
moves `msw.workerDirectory` to the bottom of `package.json` on every run, and
that key is written by the `postinstall` script.

Both configs are JSONC: the reasoning for each disabled rule lives next to the
rule, which is the only place it is any use.

## Layout - a [vertical codebase](https://tkdodo.eu/blog/the-vertical-codebase)

Grouped by **what the code is about** first, and by what kind of file it is only
second. Everything the account feature needs - its pages, its schema, its query,
its parser, its mock backend, its tests - sits in `src/account/`, because that is
what changes together. The familiar `helpers/hooks/components` split still
exists; it just lives _inside_ each vertical, where it sorts a dozen files rather
than the whole app.

The pages sit at the vertical's top level, above those folders. They are what
the feature IS - the two things a visitor can be looking at - and the folders
below hold what they are built from. Opening `src/account/` should answer "what
can you do here" before it answers "what kind of files are these".

`src/layout/` is the same rule applied to what is not a feature. The chrome
around the pages - the frame and the nav - is one thing to work on and one thing
to break, so it is one folder.

**Every folder is a thing, and what is left over is not a folder.** Four files
start the app: the entry point, the router, the route tree and the cache. They
sat in an `app/` folder, which named a category rather than a subject and
answered "where does this go" with "the drawer". They sit at the top of `src/`
now: few enough to read at a glance, and their being _outside_ every folder is
what says they belong to no feature.

Each of those folders is a **namespace**: `@account`, `@home`, `@layout`,
`@testing`. The rule is relative inside a folder, namespaced across one -
`./helpers/api` stays relative because moving the account vertical moves it too,
while a test reaching for `@testing/render-route` names its target instead of
counting `../../` up to it. It also makes the dependency direction below visible
rather than merely stated: `@account/...` inside `src/home/` is a vertical
importing a vertical, and now it looks like one.

The mapping is declared twice, in `alias.ts` (imported by `vite.config.ts` and
`vitest.config.ts`) and in the `paths` of `tsconfig.json`, which is also where
Playwright reads it from. Those two lists are the one thing to keep in sync;
`vite-tsconfig-paths` would collapse them into one at the cost of a dependency.

For those namespaces to resolve **in the editor**, a file has to belong to a
TypeScript project, and an editor finds that project by walking up to the nearest
file named exactly `tsconfig.json`. So the wide config is the discoverable one:
`tsconfig.json` covers src, e2e, server and the config files, and
`tsconfig.app.json` narrows back down to the shipped app for `yarn build`.

Doing it the other way round - the app config discoverable, the tests in a
`tsconfig.*.json` off to the side - is the arrangement that silently breaks:
`tsconfig.*.json` is invisible to that search, test files live inside `src/`
where no folder split can reach them, and a file in no project gets resolved
with default options. No `paths`, so `@account/...` reads as a missing package;
no `types`, so `expect.element` is not a function. `yarn verify` stays green
throughout, because `tsc` was never asked to compile those files at all.

```
src/                          the four files that start the app
  main.tsx                    entry point
  App.tsx                     renders the router
  routes.tsx                  the route tree, written out rather than generated
  query-client.ts             the cache the verticals put things in

src/account/                  the one business vertical
  AccountPage.tsx             the account, read-only, and the link to edit it
  EditAccountPage.tsx         accessible form (labels, roles, aria); saves,
                              then navigates back
  __tests__/                  the two pages' integration tests
  hooks/use-account.ts        the account query: one key, one fetch, one entry
  helpers/api.ts              single network boundary: GET + PUT, and the
                              mapping between the server shape and the form shape
  helpers/validation.ts       Zod schema (reuses phone in a refine)
  helpers/phone.ts            reusable pure function under unit test
  helpers/__tests__/          the phone parser's unit test, beside the parser
  components/FieldError.tsx   a field's error and the aria that points at it
  mocks/db.ts                 @msw/data collection - the stateful mock backend
  mocks/db-utils.ts           test-data factories (Faker), shared with the E2E
  mocks/handlers.ts           the account's default MSW handlers

src/home/                     the landing vertical - a page, and nothing else
  HomePage.tsx                the welcome; no query, so no loading or error state
  __tests__/                  its integration test

src/layout/                   the chrome around the pages, on every route
  RootLayout.tsx              the frame: the width, the landmarks, the <Outlet>
  Navigation.tsx              the app's map: where you can go from anywhere
  __tests__/                  the nav's integration test - it belongs to no page

src/testing/                  harness owned by no feature
  worker.ts                   the MSW worker, composed from every vertical's handlers
  render-route.tsx            mounts the real route tree over a memory history

alias.ts                      the namespaces, for Vite and Vitest
e2e/                          Playwright specs
  session.ts                  one test's isolated slice of the real API
server/api.ts                 the real account API the E2E tier runs against
public/mockServiceWorker.js   MSW service worker (generated, do not edit)
```

The rules that decide where a file goes:

- **Default to the vertical.** `phone.ts` is a generic French phone parser and
  could plausibly be a shared util - but only the account uses it, and it changes
  when the account's phone rules change. It stays in `account/helpers/` until a
  second vertical wants it.
- **Promote on the second VERTICAL, not the second call site.** `FieldError` sits
  in `account/components/` because the account is the only feature that renders
  it - six times, but all from one page. It is written to be feature-agnostic
  (typed against `AnyFieldApi`, reads no field's value), so the day a second
  vertical grows a form it moves up to a top-level `src/components/`, and that
  folder gets created then rather than kept warm now. A folder holding one file
  is a category, not a subject.
- **A component still needs a reason beyond "the file is long".** There is no
  `AccountForm`: it had one caller, and a component extracted for one caller only
  moves code without dividing it. `Navigation` is the case that passes the test -
  see above for why one caller is the wrong count for it.
- **The mock backend belongs to the feature it mocks.** `mocks/handlers.ts`
  knows about `/api/account` and nothing else; `src/testing/` holds only the
  parts that are about testing rather than about accounts.
- **Direction of dependency.** The files at the root of `src/`, plus `layout/`
  and `testing/`, may import from a vertical - they compose them. A vertical
  importing another vertical is the smell; with more than one feature this is
  where
  [eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries)
  would be pointed at the tree.

The cache is a good miniature of the split: `src/query-client.ts` owns the
QueryClient, but `accountQueryKey` lives beside the fetch that fills it in
`account/hooks/use-account.ts`. The app owns the cache; the vertical owns what it
keeps there.

Each test file opens with a short reminder of the best practices for that level.
