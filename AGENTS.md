# AGENTS.md

A React 19 demo app for the frontend standards we are adopting: TanStack Router,
Query and Form over Zod, StyleX for styling, and a testing trophy over Vitest,
MSW and Playwright. `README.md` lists the commands; this file holds the
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

Imports are **relative inside a folder, namespaced across one** — `./helpers/api`,
but `@testing/render-route`. Namespaces are declared twice, in `alias.ts` and in
`tsconfig.json` `paths`; one wired into only half of that fails either at
type-check or in the browser tests.

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

Both green, every time. Add `yarn e2e` when the change crosses the wire — a
field that never reaches the backend still type-checks and still passes the
integration suite.

Seeing a visual change in the browser is part of finishing it: `yarn dev`, with
`yarn db:start` and then `yarn api:start` running alongside for data.

## Agent docs

### Issue tracker

Issues live as GitHub issues on `aregnaud-newforma/frontend-demo-app`, driven
through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root, neither of which
exists yet. See `docs/agents/domain.md`.
