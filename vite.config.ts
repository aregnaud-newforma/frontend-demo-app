import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
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

export default defineConfig({
  build: { target: browserTargets },
  // StyleX joins the Babel pass the React Compiler already needs, rather than
  // adding a second one. See ./stylex.config.ts for why the postcss half exists.
  plugins: [react(), babel({ presets: [reactCompilerPreset()], plugins: [stylexBabelPlugin] })],
  css: { postcss: { plugins: [stylexPostcss()] } },
  resolve: { alias },
  server: { port: 5173, strictPort: true, proxy: apiProxy },
  preview: { port: 4173, strictPort: true, proxy: apiProxy },
});
