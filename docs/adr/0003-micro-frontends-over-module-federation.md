---
status: accepted
date: 2026-09-24
---

# Micro-frontends over Module Federation

The frontend is three Vite builds over one source tree. The **shell**
(`vite.config.ts`) owns `index.html`, the layout, the router, the providers and
the Sentry client. Each vertical - `account/`, `home/` - is a **remote**
(`vite.<name>.config.ts`): built and served on its own, it exposes its pages
through `src/<name>/pages.ts`, and the shell fetches them over the wire when a
route first needs them. The wiring is `@module-federation/vite`, the official
Vite plugin for Module Federation 2.0, on Vite 8 and Rolldown.

The URL is the contract between the shell and a remote. `src/routes.tsx` says
where a page lives and loads it with React Router's `lazy`; the remote says
what the page is. The QueryClient, the router context and the Sentry client are
the shell's, and reach a remote's page through the packages
`federation.config.ts` declares as singletons.

A remote may consume another remote, the same way: `home` embeds the account's
preview as `account/preview`, declared in `consumes` of `vite.home.config.ts`,
behind `React.lazy` and an error boundary of its own. It is the one such case,
and it is there to show the cost - the home build depends on the account
deployment, and the welcome has a slot that can be unavailable.

## Why

The repository demonstrates the stack a product would ship, and the products
this frontend is a demo for are owned by more than one team, each deploying on
its own cadence. A single build makes every deploy everyone's deploy. Splitting
the app by vertical is what the folder structure already did; making each
vertical a deployable is the step that turns that structure into a boundary a
team can own.

Independent deployment is the only reason to pay for this. The verticals in a
monorepo already give ownership by subject and isolation of imports; a team
that deploys as one should stay on one build.

## Considered options

- **`@module-federation/vite`.** Chosen. The official Module Federation 2.0
  runtime, decoupled from the bundler, with singleton enforcement, a manifest
  protocol and explicit Vite 8 / Rolldown support. Recommended by VoidZero.
- **`@originjs/vite-plugin-federation`.** The older community plugin, still in
  most tutorials. No release since January 2026; ships its own runtime rather
  than the 2.0 one. Rejected as unmaintained.
- **`vite-plugin-federation` 1.0 (jskits).** SSR, multi-tenant isolation and
  observability on top of the 2.0 runtime. A 1.0 from June 2026 by one author;
  rejected as too young to be the demo's reference.
- **Native Federation (`@softarc`, import maps).** Standards-based and lighter,
  but its ecosystem is Angular's. Rejected for lack of a React path.
- **single-spa.** Framework-level federation: worth it when React must share a
  page with another framework. Every part of this app is React. Rejected.
- **Rspack with native Module Federation.** The most mature host, at the cost
  of leaving Vite, which the rest of the toolchain is built on. Rejected.

## Consequences

- `yarn dev`, `yarn build` and `yarn preview` each run three processes or
  three builds, through `concurrently` or in sequence; `yarn build:<name>` and
  `yarn preview:<name>` address one. The e2e tier starts the four servers -
  the API, the shell and both remotes - and waits on each remote's
  `remoteEntry.js`, since a shell that answers before its remote does is not
  up.
- The remotes' URLs are baked into the shell's bundle at build time
  (`remoteEntryUrl` in `federation.config.ts`): the dev server's for
  `vite dev`, the preview server's for a build. A real deployment substitutes
  its own hosts there.
- `react`, `react-dom`, `react-router`, `@tanstack/react-query` and
  `@sentry/react` are shared singletons. A remote that imports a package
  carrying context or a client - a store, an i18n instance - has to add it to
  that list, or its pages will find the context missing.
- Each build collects its own StyleX stylesheet: the shell's `global.css`
  holds the layout and the tokens, a remote's `pages.css` holds its vertical
  and the tokens. Atomic class names are hashes of the declaration, so a rule
  two builds both emit is the same rule twice, not a conflict. The reset and
  the page background are the shell's alone.
- `src/routes.tsx` exports a factory. A data router clears a `lazy` loader on
  the route object once it has run, so a route tree cannot be shared between
  the app's router and the test harness's.
- The integration tier does not cross the wire: `vitest.config.ts` aliases
  `account/pages` to the source it was built from (`remotesFromSource` in
  `alias.ts`), so the tests mount the tree the shell ships without a network.
  The e2e tier is the one that proves the federation itself.
- `types/remotes.d.ts` is where TypeScript learns what `account/pages`
  resolves to - a hand-written re-export of the source, kept in step with each
  remote's `exposes`, in place of the plugin's generated `@mf-types/`.
