# AGENTS.md

A React 19 demo app for the frontend standards we are adopting: React Router,
TanStack Query and Form over Zod, StyleX for styling, and a testing trophy over
Vitest, MSW and Playwright. `README.md` lists the commands; this file holds the
conventions no config states.

Use `yarn`. Every config file carries its reasoning in comments — when something
looks surprising, the explanation is in the file that does it (`turbo.json`,
`vite.base.ts`, `vitest.config.ts`, `.oxlintrc.json`).

## Skills

A rule has one source, and it is the skill. Nothing outside `.claude/skills/`
restates one — not this file, not a comment — because `evals/` measures a skill
by removing it, and a copy that survives the removal makes that measurement read
zero effect where there is one. A rule that seems worth repeating here belongs in
the skill instead. Facts about how this repository is built are different: they
live in the config file that decides them, where a skill's `requires:` check can
find them.

## Verticals

The repository groups by **subject, not by file type**, and a subject is a
package. A vertical (`apps/account`, `apps/home`) owns everything that changes
with it: its pages at the top of `src/`, then `hooks/`, `helpers/`,
`components/`, `mocks/`, `__tests__/`. Create a sub-folder only when there is
something to put in it — a folder holding one file is a category, not a subject.

`apps/shell` owns the chrome: `index.html`, the layout, the router, the
providers and the Sentry client. `packages/testing` is the integration
harness and `packages/tokens` the StyleX variables; both are leaves that
import nothing of the app's, and the reverse is the smell.

Each vertical is also a **remote**: its own Vite build, served from its own
origin, fetched by the shell when a route needs it (`docs/adr/0003`). What a
vertical exposes to the SHELL is its `pages.ts`, reached as `account/pages` —
a federated specifier, never a package import. `federation.config.ts` names
the remotes and the packages the builds must share one copy of.

A vertical that needs another's component consumes it the same way - over the
wire, as `account/preview`, declared in `consumes` of its Vite config - never
as `@demo/account/...`. The import then names a deployment it depends on,
which is the cost worth seeing. `apps/home` embedding the account's preview is
the one case.

Imports are **relative inside a package, `@demo/<package>/<subpath>` across
one** — `./helpers/api`, but `@demo/testing/render-route`. What a package
exposes is its `exports` field, and nothing else about it is reachable. Yarn
resolves the name and TypeScript reads the same field, so the mapping is
written once (`docs/adr/0006`).

Add a package, and it is `apps/*` or `packages/*` in the root `workspaces`,
with a **scoped** name. A package named `account` rather than `@demo/account`
would make the shell's `import("account/pages")` resolve as a real subpath and
silently bundle what it must federate.

The test tier composes at the ROOT, not between apps: the shell's layout tests
use the account's mocks while the account's tests mount the shell's routes, so
an app-to-app dependency would be a cycle. `vitest.setup.ts` is where the two
meet, and the root `package.json` is where those dependencies are declared.

## Services

`server/` is two processes, each named after its subject the way `src/` is, and
they are **not the same runtime**. `Accounts/` is ASP.NET Core over Postgres: it
owns the accounts table and the surface the browser reaches. `Notifications/` is
Node - `node:http` and TypeScript, run without a build step - and owns what a
message to a person says; it is reached only by `Accounts/`, over HTTP. That
split is `docs/adr/0005`, and the point of it is that a trace crosses them
anyway.

Neither can reach the other's types, and now there is no build that could make
it possible. A shape they exchange is declared on both sides - a C# record here,
a TypeScript interface there - and that duplication is the boundary
(`docs/adr/0004`). The casing on the wire is .NET's `JsonSerializerDefaults.Web`,
so the TypeScript names are camelCase because that is what arrives, not because
TypeScript prefers it.

The Sentry setup is duplicated too, in `Accounts/SentrySetup.cs` and
`Notifications/instrument.ts`, and nothing enforces that the two agree. Editing
one is editing half of it.

## Writing components

Styles are StyleX, declared in the component file, built from the tokens in
`packages/tokens`. No raw hex, no magic `rem`, no hand-built `className`.
StyleX is a choice of this repository and lives here; anything a skill already
states does not.

The tokens are imported as `@demo/tokens/tokens.stylex`, and **no other
spelling works**: the babel plugin tests the import specifier for a `.stylex`
suffix before it resolves anything, so `@demo/tokens` is rejected with a
message that names neither the cause nor the file.

## Tests

A test's **filename**, not its folder, decides which tier runs it:
`*.unit.test.ts` in Node, `*.integration.test.tsx` in a real Chromium against
MSW, `e2e/*.spec.ts` in Playwright against the real API process.

## Before you finish

```bash
yarn verify && yarn test
```

Both green, every time. Add `yarn server:test` when the change touches
`server/Accounts/` — it is the .NET half's tests alone, and the Node half's
run under `yarn test` like any other unit test. Add `yarn e2e` when the change
crosses the wire: a field that never reaches the backend still type-checks and
still passes the integration suite.

`yarn build` is cached by Turborepo, so a second run reports `FULL TURBO` and
builds nothing. That is the cache working, not a skipped build;
`turbo run build --force` is the escape hatch if you need to see it run.

Seeing a visual change in the browser is part of finishing it: `yarn start`,
which brings up the database, both backend services and the three frontend
builds together.

## Agent docs

### Issue tracker

Issues live as GitHub issues on `aregnaud-newforma/frontend-demo-app`, driven
through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root, neither of which
exists yet. See `docs/agents/domain.md`.
