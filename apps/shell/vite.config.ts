import { defineConfig } from "vite";
import { federation } from "@module-federation/vite";
import { dts, remoteRef, remotes, shared, type RemoteName } from "../../federation.config.ts";
import {
  appPlugins,
  appVersion,
  browserTargets,
  shellSentryProject,
  sourcemap,
  sourcemapUploads,
  stylexCss,
} from "../../vite.base.ts";
import { fromRoot } from "../../stylex.config.ts";

/**
 * The SHELL: the one build that owns index.html, and the one the browser is
 * pointed at. It ships the layout and the router; the pages come from the
 * remotes, one build per vertical (apps/<name>/vite.config.ts), fetched over
 * the wire when a route first needs them. ../../federation.config.ts says which
 * remotes exist and what the three builds must hold exactly one copy of;
 * ../../vite.base.ts holds the toolchain they share.
 */

// The app builds its request from window.location.origin (see
// packages/account-core/src/api.ts), so /api/account is same-origin by
// construction.
// The real API runs in its own process on another port, which is exactly what
// a proxy is for: the browser keeps talking to one origin - cookies and all -
// and the dev/preview server forwards the API calls on. Declared for both
// servers because `vite` and `vite preview` do not share config. Only the
// shell proxies: a remote serves modules, and the page that called the API
// is served from here whichever remote it came from.
const apiProxy = { "/api": { target: "http://localhost:3001", changeOrigin: false } };

// What the browser's own profiler asks for before it will sample anything.
// `browserProfilingIntegration` in src/sentry.ts is inert without it, silently:
// the JS Self-Profiling API refuses to start unless the DOCUMENT carrying the
// script was served under this policy, and nothing reports that it did not.
// Declared for both servers for the same reason the proxy is - `vite` and
// `vite preview` do not share config - and it is the one piece of the Sentry
// setup a real deployment cannot inherit from this file: the host serving
// index.html has to send the same header.
const profilingHeaders = { "Document-Policy": "js-profiling" };

// Its own dist/, inside apps/shell/ - ../../vite.base.ts says why each build
// writes into a directory of its own now.
const outDir = "dist";

// Where the build is served, which is what Datadog matches a map's file by -
// ../../vite.base.ts's `datadogUpload` says why it is the whole origin.
const previewPort = 4173;

// A function of `command`, because the remotes' URLs are baked into the bundle
// and differ between `vite dev` and a build - see `remoteEntryUrl`.
export default defineConfig(({ command }) => ({
  // The repository's .env, not one in apps/shell/. Vite looks for it in the
  // project root, which stopped being the repository's when the app split into
  // apps/: `vite build` never noticed, because package.json's `build:*`
  // scripts hand the variables in through `process.env`, but `vite dev` is run
  // with no such flag and read no DSN at all, so Sentry stayed off in silence.
  // Only the shell: it is the build that initialises Sentry, and no remote
  // reads `import.meta.env`.
  envDir: "../..",
  // The build's version, for src/datadog.ts to report: Datadog looks a map up
  // by it, so it has to be the one the maps were uploaded under.
  define: { APP_VERSION: JSON.stringify(appVersion) },
  build: { outDir, target: browserTargets, sourcemap },
  // The uploads go last: they read what the others emitted.
  plugins: [
    ...appPlugins(),
    federation({
      name: "shell",
      // Every remote there is: the shell is what the browser is pointed at, so
      // it is the one build that must know where every page comes from.
      remotes: Object.fromEntries(
        Object.keys(remotes).map((name) => [name, remoteRef(name as RemoteName, command)]),
      ),
      shared,
      dts,
    }),
    ...sourcemapUploads(outDir, `http://localhost:${previewPort}/`, shellSentryProject),
  ],
  // The shell's own stylesheet: the layout, and the tokens every build shares.
  // What a page needs arrives with the page, in the remote's stylesheet.
  // Absolute patterns: this build runs with apps/shell/ as its cwd and the
  // tokens are outside it. ../../stylex.config.ts says what a relative one
  // would silently match instead.
  css: stylexCss([
    fromRoot("apps/shell/src/**/*.{ts,tsx}"),
    fromRoot("packages/tokens/tokens.stylex.ts"),
  ]),
  server: { port: 5173, strictPort: true, proxy: apiProxy, headers: profilingHeaders },
  preview: { port: previewPort, strictPort: true, proxy: apiProxy, headers: profilingHeaders },
}));
