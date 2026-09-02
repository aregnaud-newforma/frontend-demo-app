# AGENTS.md

A React 19 demo app for the frontend standards we are adopting: TanStack Router,
Query and Form over Zod, StyleX for styling, and a testing trophy over Vitest,
MSW and Playwright. `README.md` lists the commands; this file holds the
conventions no config states.

Use `yarn`. Every config file carries its reasoning in comments — when something
looks surprising, the explanation is in the file that does it (`alias.ts`,
`vite.config.ts`, `vitest.config.ts`, `.oxlintrc.json`).

## Skills

`.claude/skills/` holds the rules this repo expects you to follow, and they are
not optional context — read the skill **before** writing the code, not as a
review pass afterwards. Most changes here touch more than one:

- `react` — components, hooks, JSX/TSX, state, effects, context, re-render work
- `javascript` — any JS/TS at all, React included: functions, variables, comments, conditionals, modern APIs
- `typescript` — declaring or reviewing types: type vs interface, generics, unions, `any`, enums
- `engineer` — design and architecture: a new module or layer, an abstraction, where code lives, the shape of props, a hook signature, an exported API
- `testing` — any test written while building: which tier, the msw seam, the mount and queries, the file shape, fixtures

Invoke them by name with the Skill tool. Writing one component is already three
of them — `react` for the component, `javascript` for what is inside it,
`typescript` for its props.

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

- The **React Compiler** runs on every build and every test. Write plain
  components and let it memoize; `useMemo`, `useCallback` and `memo` written by
  hand are noise on top of what it already does.
- Styles are StyleX, declared in the component file, built from the tokens in
  `src/tokens.stylex.ts`. No raw hex, no magic `rem`, no hand-built `className`.

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
`yarn api:start` running alongside for data.

## Agent docs

### Issue tracker

Issues live as GitHub issues on `aregnaud-newforma/frontend-demo-app`, driven
through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root, neither of which
exists yet. See `docs/agents/domain.md`.
