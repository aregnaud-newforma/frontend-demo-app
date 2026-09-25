---
status: accepted
date: 2026-09-24
---

# yarn workspaces and Turborepo

The repository is `apps/` and `packages/` over yarn workspaces, with Turborepo
as the task runner. Each frontend build is a package of its own -
`apps/shell`, `apps/account`, `apps/home` - beside the two it shares:
`packages/tokens`, the StyleX design tokens, and `packages/testing`, the
integration harness. `server/` stays outside the npm graph entirely: it is two
processes, one of which is .NET, and `server.slnx` is what drives them.

What a package exposes is its `exports` field. `apps/account` offers its two
federated entries, the two helpers the e2e specs reach for and its MSW mocks,
and nothing else; before, every file of every vertical was reachable from
everywhere. That is the same move as `pages.ts`, one level up.

`packages/*` have no build step. Each exports its TypeScript source and the
consumer's bundler compiles it, which every consumer here already does - Vite,
or `tsc --noEmit`. `^build` is therefore free, and a token's type error
surfaces in the app that imports it rather than in a `.d.ts` nobody reads.

## Why

Two costs, both of them standing.

The namespaces were declared twice - in `alias.ts` for Vite and Vitest, in
`tsconfig.json` `paths` for TypeScript and for Playwright, which had no alias
config of its own and read that file directly. `alias.ts`'s own header called
it "the one thing to keep in sync", and a namespace wired into only one half
failed either at type-check or in the browser, never both. Package names are
one mechanism that all four tools already read, so the duplication is not
replaced by anything.

And nothing cached. `ci.yml` ran the three Vite builds in the `build` job and
again inside the `e2e` job's `webServer`, on every commit, including commits
that touched only `server/` or `docs/`.

## Considered options

- **yarn workspaces + Turborepo.** Chosen. Workspaces remove the duplication;
  turbo caches what the duplication was hiding.
- **Turborepo alone, in single-package mode.** Rejected: it caches tasks but
  has no package graph, so `alias.ts` and the `paths` block would both have
  stayed, which is the cost this was mostly about.
- **pnpm.** Rejected for now, and not on taste: it is a migration of its own.
  Worth revisiting, because yarn 1's hoisting lets any package import a
  dependency it never declared, and pnpm's stricter layout is what would
  surface those - so it should be paired with an audit rather than done
  blind.
- **Nx.** Rejected. It is a generator and plugin layer over configs whose
  whole point in this repository is being hand-written and commented.
- **`yarn workspaces run`.** Rejected: no task graph and no cache, so the
  three builds would still run twice.

## Consequences

- **The packages are scoped, and must stay that way.** `@demo/account`, never
  `account`. A package literally named `account` would make
  `import("account/pages")` in `apps/shell/src/routes.tsx` resolve as a real
  package subpath in the shell's build, silently bundling the pages it is
  supposed to fetch - the failure `alias.ts` guarded against, with nothing
  left to remove. `remotesFromSource` in `vitest.config.ts` is what maps that
  specifier to source, for the test tier only.
- **The design tokens are imported as `@demo/tokens/tokens.stylex`, and no
  other spelling works.** The StyleX babel plugin tests the import SPECIFIER
  for a `.stylex` suffix before it resolves anything, so `@demo/tokens` is
  rejected outright - with the message "Could not resolve the path to the
  imported file", which names neither the cause nor the file. Hence the
  package exports `./tokens.stylex` rather than `.`.
- **The token variable names changed once.** The plugin hashes a
  `defineVars` file by the nearest `package.json` above it plus the path from
  there, so the canonical id went from `frontend-demo-app:src/tokens.stylex.ts`
  to `@demo/tokens:tokens.stylex.ts`. All three builds changed together in one
  commit, and they are now stable by construction - exactly one `package.json`
  sits above that file. Do not deploy a new shell beside an old remote.
- **StyleX's postcss globs are absolute.** That half scans globs against
  `process.cwd()`, and turbo runs each `vite build` with its own app as cwd. A
  relative pattern would have matched nothing and emitted a stylesheet with no
  rules - no error, just an unstyled page. `fromRoot()` in `stylex.config.ts`
  anchors them; the check that they still match is that each build's CSS is
  not empty.
- **Each app writes into its own `dist/`.** Turbo restores a cache entry by
  overwriting the task's declared outputs, so three builds sharing one
  directory would have had one restore clobber another's artefacts.
- **The app-to-app test dependencies are deliberately undeclared.**
  `apps/shell`'s layout tests use the account's mocks while `apps/account`'s
  tests mount the shell's routes. Declaring either would be a cycle - turbo
  traverses `devDependencies` - and declaring both in the ROOT package instead
  turns out to cost the whole cache: an internal dependency of the root feeds
  turbo's GLOBAL hash, so with the apps listed there, editing one of them
  invalidated every task in the repository. Measured, then removed. Yarn
  symlinks every workspace member into the root `node_modules` whether or not
  anything declares it, so the imports resolve either way; what is left is a
  known, written-down gap between what the test files import and what the
  manifests say. `@demo/testing` IS declared, by each app, because the harness
  is a leaf and that edge is acyclic. `test` is a root task with no topology,
  and the contract that the FILENAME decides a test's tier is unchanged.
- **A cache hit skips the Sentry upload, and only `SENTRY_RELEASE` keeps that
  honest.** It is `${{ github.sha }}` in `ci.yml`, which makes every commit's
  build hash unique. `SENTRY_AUTH_TOKEN` is in the task's `env` for a second
  reason: `vite.base.ts` keys `sourcemap` on it, so set and unset are two
  different bundles. Turbo 2 runs tasks in strict env mode, so that list is
  also what gets forwarded into the task.
- **`.turbo/` has to be gitignored.** A root task's default inputs are the
  whole root package, so the cache directory was hashing itself: every run
  wrote into it, changing the hash, guaranteeing the next run missed.
- **npm no longer runs here.** Turbo needs `devEngines.packageManager` to
  resolve the workspace, and npm enforces it. Nothing in this repository
  invoked `npx`.
- **This amends 0003's file references** - `vite.<name>.config.ts` is now
  `apps/<name>/vite.config.ts`, `types/remotes.d.ts` is
  `apps/shell/types/remotes.d.ts` - without changing its decision. The remotes
  are still separate builds fetched over the wire, and `apps/home` still
  declares `consumes: ["account"]` rather than importing `@demo/account`.
