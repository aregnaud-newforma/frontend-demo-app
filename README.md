# Frontend best practices - App demo

This project is a demo reference for the frontend standards we are adopting across our repos.

```bash
yarn install
yarn browsers:install   # one-time: Chromium, used by Vitest and Playwright
cp .env.example .env    # one-time: where the services find their database and each other
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
| Micro-frontends           | Each vertical is its own build, fetched by the shell at runtime (Module Federation) |
| Distributed tracing       | Browser, account API and notifications service report as one Sentry trace           |
| Testing strategy (Trophy) | Playwright, Vitest, MSW, FakerJS and Zod, weighted toward integration, unit and E2E |
| Build-time CSS-in-JS      | StyleX compiles styles at build time: no runtime cost, no class collisions          |     |

## Scripts

```bash
yarn start         # everything in one terminal: db:start, then both services and dev
yarn dev           # the shell and both remotes, each on its own port; the shell proxies /api
yarn build         # tsc, then the three builds into dist/shell, dist/account, dist/home
yarn preview       # the three builds served as they deploy (build first)
yarn db:start      # the Postgres behind the API (compose.yaml), and wait for it
yarn api:start     # the account API (.NET) on its own; migrates the database on start
yarn notifications:start  # the notifications service (.NET), which the account API calls
yarn api:test      # both services' tests (xunit); starts a Postgres container itself
yarn db:generate   # a new migration into server/Api/Migrations/ - name it: yarn db:generate AddX
yarn test          # unit + integration   (yarn test:watch to keep it open)
yarn e2e           # end-to-end; starts both services and the preview build itself
yarn verify        # oxlint + oxfmt --check + both tsc projects + dotnet build - the CI gate
yarn lint          # oxlint  (yarn lint:fix to apply what it can)
yarn format        # oxfmt   (yarn format:check to only report)
```
