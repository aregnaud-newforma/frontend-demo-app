import { fileURLToPath } from "node:url";
import type { PluginItem } from "@babel/core";
import styleXBabelPlugin from "@stylexjs/babel-plugin";
import styleXPostcssPlugin from "@stylexjs/postcss-plugin";

/**
 * StyleX runs in two passes, and both need the same options - so they are
 * written once here, the way ./alias.ts holds the namespaces for the configs
 * that need them.
 *
 * 1. A BABEL pass over the app's own modules, which turns every
 *    `stylex.create({...})` into the class names it compiles to. This is what
 *    makes the runtime cost nearly nothing: by the time the browser sees it,
 *    `stylex.props(styles.card)` is a string, not a computation.
 * 2. A POSTCSS pass that scans the same files, collects every style it finds
 *    across all of them, and replaces the `@stylex;` directive in
 *    src/global.css with the single stylesheet they add up to.
 *
 * Two passes rather than one because they answer different questions. The babel
 * pass rewrites a module and can only see that module; the CSS is the union of
 * every module, which only something running over the whole tree can know. It
 * is also why the output is one stylesheet loaded upfront rather than a chunk
 * per component - the identical declaration written in six files collapses to a
 * single rule exactly once.
 *
 * Imported by vite.config.ts (the app) and vitest.config.ts (Browser Mode, which
 * serves the components through its own Vite pipeline and would otherwise render
 * them with class names no stylesheet defines).
 */
const rootDir = fileURLToPath(new URL(".", import.meta.url));

// `dev` keeps the readable, per-file debug class names in development and drops
// them in the production bundle. The e2e specs run against `vite build`, so what
// they drive is the minified output, not this.
const dev = process.env.NODE_ENV !== "production";

/**
 * The babel half. `commonJS` module resolution is what lets a `.stylex.ts` file
 * of `defineVars` be imported across modules and still resolve to one set of CSS
 * variables - the tokens in src/tokens.stylex.ts depend on it.
 */
export const stylexBabelPlugin = [
  styleXBabelPlugin,
  { dev, unstable_moduleResolution: { type: "commonJS", rootDir } },
  // StyleX ships types written against Babel 7 (it bundles its own @babel/core
  // 7 to run with), while the app's pass is Babel 8 - so the two `PluginItem`
  // shapes disagree even though the plugin itself runs fine on both, which the
  // build proves. Asserted once here rather than at each of the two call sites.
] as unknown as PluginItem;

/** The postcss half. Same files, same options, different question. */
export const stylexPostcss = () =>
  styleXPostcssPlugin({
    include: ["src/**/*.{ts,tsx}"],
    // The generated rules go in a CSS layer, so anything written by hand
    // outside a layer beats them without needing a specificity fight.
    useCSSLayers: true,
    babelConfig: {
      // This pass re-parses the .tsx sources itself, and its Babel knows only
      // plain JS by default. Enabling the two syntaxes in the PARSER is enough:
      // nothing here has to transform JSX or strip types, it only has to read
      // far enough to find the `stylex.create` calls. Doing it with
      // `parserOpts` rather than @babel/preset-react and
      // @babel/preset-typescript keeps two build-only dependencies out of the
      // tree - and avoids pinning them, since StyleX runs its own nested
      // Babel 7 while the app's pass is on Babel 8.
      parserOpts: { plugins: ["jsx", "typescript"] },
      plugins: [stylexBabelPlugin],
    },
  });
