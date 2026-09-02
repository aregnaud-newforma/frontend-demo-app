## E2E

Playwright, in `e2e/*.spec.ts`, against the production bundle and the **real
API process** — `playwright.config.ts` starts both. Nothing is intercepted: no
msw, no seeded store, no factory standing in for the backend.

E2E is the only level where the real server answers, so it is the only level
that can prove the request the app builds is a request the API takes. That sets
its **depth** and its **breadth**:

- **Depth: every value crosses the wire.** The journey is filled the way a user
  fills it — every field, read back from what the server returned — rather
  than the thinnest path that reaches the end. A form saved with one field
  proves the navigation and nothing about the fields beside it.
- **Breadth: happy paths only.** An edge case, a validation message, a refused
  value belongs at Integration page, where it costs milliseconds instead of a
  build and a browser.

## The journey

- **Its own session.** `startSession(page, request, account)` from
  `e2e/session.ts` gives the test a slice of the backend no other spec can
  reach, and seeds the account it needs. Build the account with the vertical's
  factory — `accountFactory.build()` — so the spec and the integration tests
  agree on what valid is.
- **The same ladder.** `page.getByRole(...)`, `page.getByLabel(...)`, resolved
  from the same accessibility tree; `await expect(locator).toBeVisible()`.
- **Queries in helpers, not inline.** A locator the journey reaches more than
  once — `summaryValue(page, term)` — is a function at the top of the file, or
  in a page object when the directory grows one.
- **Given / When / Then**, and a name that states the journey, exactly as at
  Integration page.

## Running it

`yarn e2e` builds and boots what it needs; a cold run pays a full `yarn build`
first. Run it when the change crosses the wire — a new field, a changed
payload, a new endpoint — since a field that never reaches the backend still
passes every level below.
