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

export default defineConfig({
  // StyleX joins the Babel pass the React Compiler already needs, rather than
  // adding a second one. See ./stylex.config.ts for why the postcss half exists.
  plugins: [react(), babel({ presets: [reactCompilerPreset()], plugins: [stylexBabelPlugin] })],
  css: { postcss: { plugins: [stylexPostcss()] } },
  resolve: { alias },
  server: { port: 5173, strictPort: true, proxy: apiProxy },
  preview: { port: 4173, strictPort: true, proxy: apiProxy },
});
