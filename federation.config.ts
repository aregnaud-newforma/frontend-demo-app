/**
 * The micro-frontend contract: which builds exist, where each one is served
 * from, and which packages must exist exactly once on the page.
 *
 * The app is three Vite builds over one source tree (docs/adr/0003). The SHELL
 * (vite.config.ts) owns index.html, the layout, the router and the providers.
 * Each vertical is a REMOTE (vite.<name>.config.ts): built and served on its
 * own, it exposes its pages, and the shell fetches them over the wire when a
 * route needs them. The specifier the shell imports - `account/pages` - is the
 * remote's name plus the key it exposes; types/remotes.d.ts is where TypeScript
 * learns what that specifier resolves to.
 *
 * Written once here rather than in each config so that a remote's name and
 * port cannot disagree between the build that serves it and the shell that
 * fetches it - the same reason ./alias.ts exists.
 */

/**
 * One entry per remote. `dev` is the port `vite` serves it on, `preview` the
 * port `vite preview` serves its build on - the same split the shell has
 * between 5173 and 4173, so the two can run side by side.
 */
export const remotes = {
  account: { dev: 5174, preview: 4174 },
  home: { dev: 5175, preview: 4175 },
} as const;

export type RemoteName = keyof typeof remotes;

/** The file every remote build emits and the shell fetches first. */
export const remoteEntry = "remoteEntry.js";

/**
 * Off in every build: the plugin would otherwise generate `@mf-types/` - into
 * dist/ from a build, into the repo root from a dev server - and the shell's
 * types for a remote are hand-written in types/remotes.d.ts instead, where
 * they follow the source rather than a build artefact.
 */
export const dts = false;

/**
 * Where the shell finds a remote. A `vite build` bakes the preview URL into
 * the bundle, which is what the e2e tier runs against; `vite dev` points at
 * the remote's dev server instead, so `yarn dev` runs the whole app with hot
 * reload across all three. A real deployment would substitute its own hosts
 * here - the URL is a build-time value either way.
 */
export const remoteEntryUrl = (name: RemoteName, command: "build" | "serve") =>
  `http://localhost:${remotes[name][command === "build" ? "preview" : "dev"]}/${remoteEntry}`;

/**
 * One remote as a consumer declares it - the shell for every remote, a remote
 * for the one it embeds a component from (vite.home.config.ts). `type:
 * "module"` because the remotes are ESM builds of this same plugin; the
 * default is the global-variable format webpack emits.
 */
export const remoteRef = (name: RemoteName, command: "build" | "serve") => ({
  type: "module",
  name,
  entry: remoteEntryUrl(name, command),
});

/**
 * Packages the shell and the remotes must share ONE instance of, because each
 * carries state a second copy would not see:
 *
 * - `react` / `react-dom`: two Reacts on one page break hooks outright.
 * - `react-router`: a remote's <Link> reads the router context the shell
 *   provides; from a second copy of the package it would find none, and throw.
 * - `@tanstack/react-query`: same shape - `useQuery` in a remote must reach the
 *   QueryClient the shell's provider holds.
 * - `@sentry/react`: the SDK is initialised once, in the shell, and a remote's
 *   `Sentry.startSpan` from another copy would report to a client that was
 *   never set up: no error, no span.
 *
 * `singleton` makes the runtime hand every consumer the first copy loaded and
 * warn if a remote asked for a version the shell's copy does not satisfy. The
 * versions are read from package.json.
 */
export const shared = {
  react: { singleton: true },
  "react-dom": { singleton: true },
  "react-router": { singleton: true },
  "@tanstack/react-query": { singleton: true },
  "@sentry/react": { singleton: true },
};
