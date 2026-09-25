# Frontend best practices - App demo

This project is a demo reference for the frontend standards we are adopting across our repos.

```bash
yarn install
yarn browsers:install   # one-time: Chromium, used by Vitest and Playwright
cp .env.example .env    # one-time: where the services find their database and each other
cp apps/mobile/.env.example apps/mobile/.env   # one-time: where the PHONE reaches the API
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

The same three screens run on iOS and Android from `apps/mobile`, as native
tabs with the form pushed on the account's stack.

## What it demonstrates

| Practice                      | What it means                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| Modern toolchain              | One Rust-based pipeline: Rolldown to build, oxlint to lint, oxfmt to format          |
| Vertical codebase             | Group by feature, not file type: pages, schema, queries, mocks, tests colocated      |
| Monorepo                      | yarn workspaces + Turborepo: one install, one task graph, cached builds              |
| Micro-frontends               | Each vertical is its own build, fetched by the shell at runtime (Module Federation)  |
| Mobile, from one codebase     | An Expo app sharing the schema, the API client and the mocks with the web (ADR 0007) |
| Distributed tracing           | Browser, .NET account API and Node notifications service, one Sentry trace           |
| Testing strategy (Trophy)     | Playwright, Vitest, MSW, FakerJS and Zod, weighted toward integration, unit and E2E  |
| One mock network, two runners | The same MSW handlers answer the browser tier and the jest-expo one                  |
| Build-time CSS-in-JS          | StyleX compiles styles at build time: no runtime cost, no class collisions           |     |

## Scripts

```bash
yarn start                # everything in one terminal: db:start, then both services and dev
yarn mobile:start         # the Expo dev server, against those same services
yarn mobile:prebuild      # once per machine: the native projects a dev build needs
yarn mobile:ios           # build and run it on the simulator (mobile:android for the other)
yarn dev                  # the shell and both remotes, each on its own port; the shell proxies /api
yarn build                # tsc, then the three builds into apps/*/dist - cached, so a second run is a no-op
yarn preview              # the three builds served as they deploy (build first)
yarn db:start             # the Postgres behind the accounts service, and wait for it
yarn accounts:start       # the account API (.NET) alone; migrates the database on start
yarn notifications:start  # the notifications service (Node), which the account API calls
yarn server:test          # the account API's tests (xunit); starts a Postgres container itself
yarn server:build         # its Release build, which uploads its debug files
yarn db:generate          # a migration into server/Accounts/Migrations/ - yarn db:generate AddX
yarn test                 # unit + integration   (yarn test:watch to keep it open)
yarn test:native          # the mobile app's tier (jest-expo); yarn test does not reach it
yarn e2e                  # end-to-end; starts both services and the preview build itself
yarn lighthouse           # Lighthouse CI over the preview build; start preview + both services first
yarn verify               # oxlint + oxfmt --check + both tsc projects + dotnet build - the CI gate
yarn lint                 # oxlint  (yarn lint:fix to apply what it can)
yarn format               # oxfmt   (yarn format:check to only report)
```
