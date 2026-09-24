import { fileURLToPath } from "node:url";
import type { PluginItem } from "@babel/core";
import styleXBabelPlugin from "@stylexjs/babel-plugin";
import styleXPostcssPlugin from "@stylexjs/postcss-plugin";

/**
 * StyleX runs in two passes, and both need the same options - so they are
 * written once here, the way ./federation.config.ts holds the micro-frontend
 * contract for the builds that need it.
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

/**
 * A glob anchored at the repository root, whatever directory the build was
 * launched from.
 *
 * The postcss half globs against `process.cwd()` unless the pattern is
 * absolute, and each app is built with its own directory as the cwd - so a
 * relative `packages/tokens/**` written here would look for
 * apps/account/packages/tokens/ and match nothing. Nothing would fail: the
 * plugin would emit a stylesheet with no rules and the page would render
 * unstyled. Absolute patterns take the question off the table.
 */
export const fromRoot = (glob: string) => `${rootDir}${glob}`;

// `dev` keeps the readable, per-file debug class names in development and drops
// them in the production bundle. The e2e specs run against `vite build`, so what
// they drive is the minified output, not this.
const dev = process.env.NODE_ENV !== "production";

/**
 * The babel half. `commonJS` module resolution is what lets a `.stylex.ts` file
 * of `defineVars` be imported across modules and still resolve to one set of CSS
 * variables - the tokens in packages/tokens depend on it.
 */
export const stylexBabelPlugin = [
  styleXBabelPlugin,
  { dev, unstable_moduleResolution: { type: "commonJS", rootDir } },
  // StyleX ships types written against Babel 7 (it bundles its own @babel/core
  // 7 to run with), while the app's pass is Babel 8 - so the two `PluginItem`
  // shapes disagree even though the plugin itself runs fine on both, which the
  // build proves. Asserted once here rather than at each of the two call sites.
] as unknown as PluginItem;

/**
 * The postcss half. Same options, different question - and, unlike the babel
 * half, it has to be told WHICH files. It scans globs rather than following
 * imports, so `include` decides what a stylesheet collects: a remote build
 * names its own vertical plus the tokens (see ../federation.config.ts), the
 * shell names the layout, and Browser Mode names all of src/ because it mounts
 * anything. A file scanned twice by two builds yields the same class names in
 * both - the hash is of the declaration - so the sheets overlap harmlessly
 * where the pages share a style.
 */
export const stylexPostcss = (include: string[]) =>
  styleXPostcssPlugin({
    include,
    // What a relative pattern would resolve against, for the same reason
    // `fromRoot` exists. The plugin also reports watch dependencies through it.
    cwd: rootDir,
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
