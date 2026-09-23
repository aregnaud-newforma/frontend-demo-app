# Frontend best practices - App demo

This project is a demo reference for the frontend standards we are adopting across our repos.

```bash
yarn install
yarn browsers:install   # one-time: Chromium, used by Vitest and Playwright
cp .env.example .env    # one-time: where the API finds its database
yarn db:start           # Postgres, in Docker; the API and the e2e suite need it
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
yarn db:start      # the Postgres behind the API (compose.yaml), and wait for it
yarn api:start     # the account API on its own; migrates the database on start
yarn db:generate   # a new migration into server/migrations/, from server/schema.ts
yarn test          # unit + integration   (yarn test:watch to keep it open)
yarn e2e           # end-to-end; starts the API and the preview build itself
yarn verify        # oxlint + oxfmt --check + both tsc projects - the CI gate
yarn lint          # oxlint  (yarn lint:fix to apply what it can)
yarn format        # oxfmt   (yarn format:check to only report)
```
