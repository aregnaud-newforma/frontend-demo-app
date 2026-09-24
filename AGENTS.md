# AGENTS.md

A React 19 demo app for the frontend standards we are adopting: React Router,
TanStack Query and Form over Zod, StyleX for styling, and a testing trophy over
Vitest, MSW and Playwright. `README.md` lists the commands; this file holds the
conventions no config states.

Use `yarn`. Every config file carries its reasoning in comments — when something
looks surprising, the explanation is in the file that does it (`alias.ts`,
`vite.config.ts`, `vitest.config.ts`, `.oxlintrc.json`).

## Skills

A rule has one source, and it is the skill. Nothing outside `.claude/skills/`
restates one — not this file, not a comment — because `evals/` measures a skill
by removing it, and a copy that survives the removal makes that measurement read
zero effect where there is one. A rule that seems worth repeating here belongs in
the skill instead. Facts about how this repository is built are different: they
live in the config file that decides them, where a skill's `requires:` check can
find them.

## Verticals

`src/` groups by **subject, not by file type**. A vertical (`account/`, `home/`)
owns everything that changes with it: its pages at the top, then `hooks/`,
`helpers/`, `components/`, `mocks/`, `__tests__/`. Create a sub-folder only when
there is something to put in it — a folder holding one file is a category, not a
subject.

`layout/` and `testing/` are infrastructure: they may import verticals, and the
reverse is the smell.

Each vertical is also a **remote**: its own Vite build, served from its own
origin, fetched by the shell when a route needs it (`docs/adr/0003`). What a
vertical exposes is its `pages.ts`; the shell reaches it as `account/pages`,
never as `@account/...`. `federation.config.ts` names the remotes and the
packages the builds must share one copy of.

A vertical that needs another's component consumes it the same way - over the
wire, as `account/preview`, declared in `consumes` of its Vite config - never
as `@account/...`. The import then names a deployment it depends on, which is
the cost worth seeing. `home/` embedding the account's preview is the one case.

Imports are **relative inside a folder, namespaced across one** — `./helpers/api`,
but `@testing/render-route`. Namespaces are declared twice, in `alias.ts` and in
`tsconfig.json` `paths`; one wired into only half of that fails either at
type-check or in the browser tests.

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
`src/tokens.stylex.ts`. No raw hex, no magic `rem`, no hand-built `className`.
StyleX is a choice of this repository and lives here; anything a skill already
states does not.

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
