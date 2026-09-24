import { defineConfig } from "vite";
import { federation } from "@module-federation/vite";
import { alias } from "./alias.ts";
import { dts, remoteEntryUrl, remotes, shared } from "./federation.config.ts";
import { appPlugins, browserTargets, sentrySourcemaps, sourcemap, stylexCss } from "./vite.base.ts";

/**
 * The SHELL: the one build that owns index.html, and the one the browser is
 * pointed at. It ships the layout and the router; the pages come from the
 * remotes, one build per vertical (vite.<name>.config.ts), fetched over the
 * wire when a route first needs them. ./federation.config.ts says which remotes
 * exist and what the three builds must hold exactly one copy of; ./vite.base.ts
 * holds the toolchain they share.
 */

// The app builds its request from window.location.origin (see
// src/account/helpers/api.ts), so /api/account is same-origin by construction.
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

const outDir = "dist/shell";

// A function of `command`, because the remotes' URLs are baked into the bundle
// and differ between `vite dev` and a build - see `remoteEntryUrl`.
export default defineConfig(({ command }) => ({
  // One pre-bundle cache per build - ./vite.base.ts says why the three cannot
  // share the default.
  cacheDir: "node_modules/.vite/shell",
  build: { outDir, target: browserTargets, sourcemap },
  // The Sentry plugin goes last: it reads what the others emitted.
  plugins: [
    ...appPlugins(),
    federation({
      name: "shell",
      remotes: Object.fromEntries(
        Object.keys(remotes).map((name) => [
          name,
          // `type: "module"` because the remotes are ESM builds of this same
          // plugin; the default is the global-variable format webpack emits.
          { type: "module", name, entry: remoteEntryUrl(name as keyof typeof remotes, command) },
        ]),
      ),
      shared,
      dts,
    }),
    ...sentrySourcemaps(outDir),
  ],
  // The shell's own stylesheet: the layout, and the tokens every build shares.
  // What a page needs arrives with the page, in the remote's stylesheet.
  css: stylexCss(["src/layout/**/*.tsx", "src/*.{ts,tsx}"]),
  resolve: { alias },
  server: { port: 5173, strictPort: true, proxy: apiProxy, headers: profilingHeaders },
  preview: { port: 4173, strictPort: true, proxy: apiProxy, headers: profilingHeaders },
}));
