# Frontend best practices - App demo

This project is a demo reference for the frontend standards we are adopting across our repos.

```bash
yarn install
yarn browsers:install   # one-time: Chromium, used by Vitest and Playwright
yarn test               # unit + integration
yarn e2e                # end-to-end, against a real API
```

## The app

```
/                -> the welcome
/account         -> the account, read-only, and a link to edit it
/account/edit    -> the form; on save, back to /account
```

## What it demonstrates

| Practice                  | What it means                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------- |
| Modern toolchain          | One Rust-based pipeline: Rolldown to build, oxlint to lint, oxfmt to format         |
| Vertical codebase         | Group by feature, not file type: pages, schema, queries, mocks, tests colocated     |
| Testing strategy (Trophy) | Playwright, Vitest, MSW, FakerJS and Zod, weighted toward integration, unit and E2E |
| Build-time CSS-in-JS      | StyleX compiles styles at build time: no runtime cost, no class collisions          |     |

## Scripts

```bash
yarn dev           # Vite dev server (proxies /api to the API, if it is running)
yarn api:start     # the account API on its own
yarn test          # unit + integration   (yarn test:watch to keep it open)
yarn e2e           # end-to-end; starts the API and the preview build itself
yarn verify        # oxlint + oxfmt --check + both tsc projects - the CI gate
yarn lint          # oxlint  (yarn lint:fix to apply what it can)
yarn format        # oxfmt   (yarn format:check to only report)
```

## Tracing the API

`server/api.ts` reports one [Langfuse](https://langfuse.com) trace per request:
`get-account`, `update-account`, `seed-account`, and the two rejections, with
the write nested under the PUT that made it. Traces carry the session id the
E2E specs already use, so a whole spec's round trips read back as one session.

Off by default. Copy `.env.example` to `.env` and fill in a project's keys to
turn it on - `yarn api:start` and `yarn e2e` then send traces to that project.
Without keys the server runs exactly as before.

Nothing personal is traced: spans record the route, the status, the account id
and which fields a request touched, never the name, email, phone or bio behind
them. `server/instrumentation.ts` masks emails and phone numbers on the way out
as a second lock on that.
