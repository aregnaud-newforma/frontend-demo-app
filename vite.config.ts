import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { alias } from "./alias.ts";
import { stylexBabelPlugin, stylexPostcss } from "./stylex.config.ts";

// plugin-react v6 transforms with Oxc, not Babel, so the React Compiler is not
// an option on `react()` any more: it runs as its own Babel pass alongside it.

// The app builds its request from window.location.origin (see
// src/account/helpers/api.ts), so /api/account is same-origin by construction.
// The real API runs in its own process on another port, which is exactly what
// a proxy is for: the browser keeps talking to one origin - cookies and all -
// and the dev/preview server forwards the API calls on. Declared for both
// servers because `vite` and `vite preview` do not share config.
const apiProxy = { "/api": { target: "http://localhost:3001", changeOrigin: false } };

// The browsers this app is built for, restated in esbuild's own vocabulary.
// Vite does not read `browserslist` — `build.target` takes esbuild names
// (`safari16.4`), not browserslist queries (`safari >= 16.4`), and a
// `browserslist` field is ignored in silence. So the floor is declared twice,
// the same way `alias.ts` and tsconfig `paths` are: here for what Vite emits,
// and in package.json for every tool that does read browserslist.
//
// These values are Vite 8's own `baseline-widely-available` default, written
// down rather than inherited: that default is pinned per Vite major, so a Vite
// upgrade would otherwise move which browsers this app supports with nothing in
// the diff to show it.
//
// It lowers syntax only. Nothing here polyfills a missing method, so an API
// newer than this floor - `Set.prototype.difference`, say - throws at runtime on
// a browser at the floor, and works in `vite dev`, which always runs esnext.
const browserTargets = ["chrome111", "edge111", "firefox114", "safari16.4", "ios16.4"];

// Source maps, and the upload that makes them worth generating - both together
// or neither, keyed on the token.
//
// A production bundle with no map gives Sentry minified frames: `t.default` at
// column 4831, which names nothing. The maps fix that, but they are the source
// code, so shipping them alongside the bundle publishes it. The plugin closes
// that gap by uploading them to Sentry and DELETING them from dist/ afterwards -
// Sentry can un-minify the stack, the browser is served nothing extra.
//
// `hidden` is what stops the `//# sourceMappingURL=` comment being emitted: the
// map is written, but nothing in the shipped file points at a file that is about
// to be deleted.
//
// Without the token there is nowhere to upload to, so no map is generated
// either - a plain `yarn build` leaves nothing behind to leak.
//
// `url` is NOT optional here. The plugin defaults to sentry.io, and this
// organisation is hosted in the EU region, where an upload to the default host
// is accepted by nothing.
//
// The token is read from `process.env`, and package.json's `build` runs Vite through
// `node --env-file-if-exists=.env` for it: Vite reads .env into
// `import.meta.env` for the CLIENT bundle and deliberately leaves `process.env`
// alone, so a token sitting in .env is invisible here without that flag - the
// build succeeds, uploads nothing, and says nothing about it. CI passes the
// same variable its own way and needs no .env at all.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

const sentrySourcemaps = sentryAuthToken
  ? [
      sentryVitePlugin({
        org: "alexisregnaud",
        project: "frontend-demo-app",
        url: "https://de.sentry.io",
        authToken: sentryAuthToken,
        sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
      }),
    ]
  : [];

export default defineConfig({
  build: { target: browserTargets, sourcemap: sentryAuthToken ? "hidden" : false },
  // StyleX joins the Babel pass the React Compiler already needs, rather than
  // adding a second one. See ./stylex.config.ts for why the postcss half exists.
  // The Sentry plugin goes last: it reads what the others emitted.
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()], plugins: [stylexBabelPlugin] }),
    ...sentrySourcemaps,
  ],
  css: { postcss: { plugins: [stylexPostcss()] } },
  resolve: { alias },
  server: { port: 5173, strictPort: true, proxy: apiProxy },
  preview: { port: 4173, strictPort: true, proxy: apiProxy },
});
