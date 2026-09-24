import type { CSSOptions, PluginOption, UserConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { federation } from "@module-federation/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { alias } from "./alias.ts";
import {
  dts,
  remoteEntry,
  remoteRef,
  remotes,
  shared,
  type RemoteName,
} from "./federation.config.ts";
import { stylexBabelPlugin, stylexPostcss } from "./stylex.config.ts";

/**
 * What the shell build and every remote build have in common: the same
 * toolchain over the same source tree, differing only in which part of it they
 * ship. Held here so a plugin added to one build cannot be forgotten in another
 * - the way ./alias.ts holds the namespaces and ./stylex.config.ts the StyleX
 * options. vitest.config.ts declares its own copy of the plugin list: Browser
 * Mode serves through its own pipeline and takes no `vite.config.ts`.
 */

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
export const browserTargets = ["chrome111", "edge111", "firefox114", "safari16.4", "ios16.4"];

// plugin-react v6 transforms with Oxc, not Babel, so the React Compiler is not
// an option on `react()` any more: it runs as its own Babel pass alongside it.
export const appPlugins = (): PluginOption[] => [
  react(),
  babel({ presets: [reactCompilerPreset()], plugins: [stylexBabelPlugin] }),
];

// The postcss half of StyleX, given the slice of src/ whose styles THIS build's
// stylesheet collects. The babel half above compiles whatever a build imports;
// the postcss half has to be told, because it scans files rather than following
// imports, and a remote scanning all of src/ would ship the shell's CSS and
// every other remote's alongside its own. See ./stylex.config.ts.
export const stylexCss = (include: string[]): CSSOptions => ({
  postcss: { plugins: [stylexPostcss(include)] },
});

// Source maps, and the upload that makes them worth generating - both together
// or neither, keyed on the token.
//
// A production bundle with no map gives Sentry minified frames: `t.default` at
// column 4831, which names nothing. The maps fix that, but they are the source
// code, so shipping them alongside the bundle publishes it. The plugin closes
// that gap by uploading them to Sentry and DELETING them from the build's own
// outDir afterwards - Sentry can un-minify the stack, the browser is served
// nothing extra. Its OWN outDir, not dist/ as a whole: the three builds each
// run this plugin, and one deleting another's maps before they were uploaded
// would leave that build's frames minified with nothing to say why.
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
// The token is read from `process.env`, and package.json's `build:*` scripts run
// Vite through `node --env-file-if-exists=.env` for it: Vite reads .env into
// `import.meta.env` for the CLIENT bundle and deliberately leaves `process.env`
// alone, so a token sitting in .env is invisible here without that flag - the
// build succeeds, uploads nothing, and says nothing about it. CI passes the
// same variable its own way and needs no .env at all.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

export const sourcemap = sentryAuthToken ? ("hidden" as const) : false;

export const sentrySourcemaps = (outDir: string): PluginOption[] =>
  sentryAuthToken
    ? [
        sentryVitePlugin({
          org: "alexisregnaud",
          project: "frontend-demo-app",
          url: "https://de.sentry.io",
          authToken: sentryAuthToken,
          sourcemaps: { filesToDeleteAfterUpload: [`./${outDir}/**/*.map`] },
        }),
      ]
    : [];

type RemoteOptions = {
  /** What this remote offers: the key the consumer imports, the file behind it. */
  exposes: Record<string, string>;
  /**
   * The remotes THIS one embeds a component from, if any. A vertical that
   * needs another's component consumes it the way the shell consumes pages -
   * over the wire, by `<remote>/<key>` - and this is where it says so. The
   * import then names a deployment the vertical depends on, which is the cost
   * `@account/...` from inside src/home/ would hide.
   */
  consumes?: RemoteName[];
};

/**
 * One remote's whole Vite config (docs/adr/0003). A remote ships no index.html
 * and no entry of its own: its build is the `remoteEntry.js` the shell fetches,
 * plus the chunks behind the modules it `exposes`. Everything a page needs
 * around it - the router, the QueryClient, Sentry - is the shell's, reached
 * through the `shared` singletons.
 *
 * `command` is passed through because a consumed remote's URL differs between
 * `vite dev` and a build - see `remoteEntryUrl`.
 *
 * `server.origin` is what makes the remote's dev server name itself in the
 * asset URLs it emits: without it a chunk is requested from the SHELL's origin,
 * which does not have it.
 */
export const remoteConfig = (
  name: RemoteName,
  { exposes, consumes = [] }: RemoteOptions,
  command: "build" | "serve",
): UserConfig => {
  const outDir = `dist/${name}`;
  const port = remotes[name];
  const consumed = Object.fromEntries(
    consumes.map((remote) => [remote, remoteRef(remote, command)]),
  );

  return {
    // public/ is the shell's: index.html's favicon, the MSW worker the tests
    // register. A remote serves what it exposes and nothing else.
    publicDir: false,
    // Its own pre-bundle cache. The default is node_modules/.vite for every
    // build of this root, and `yarn dev` runs three at once: each writes
    // pre-bundled dependencies carrying ITS federation ids, and the last to
    // write wins for all - the shell then fails to resolve a `virtual:mf:` id
    // that belongs to a remote. See cacheDir in ./vite.config.ts as well.
    cacheDir: `node_modules/.vite/${name}`,
    // What the dev server's dependency scan starts from. Without an
    // index.html it would crawl the root's - the SHELL's - and fail on the
    // `account/pages` imports in src/routes.tsx, which only the shell's
    // federation plugin can resolve.
    optimizeDeps: { entries: Object.values(exposes) },
    build: {
      outDir,
      target: browserTargets,
      sourcemap,
      // Rolldown otherwise wants an index.html. The exposed modules are the
      // build's entries; the plugin adds remoteEntry.js beside them.
      rolldownOptions: { input: Object.values(exposes) },
    },
    plugins: [
      ...appPlugins(),
      federation({ name, filename: remoteEntry, exposes, remotes: consumed, shared, dts }),
      ...sentrySourcemaps(outDir),
    ],
    css: stylexCss([`src/${name}/**/*.{ts,tsx}`, "src/tokens.stylex.ts"]),
    resolve: { alias },
    server: { port: port.dev, strictPort: true, origin: `http://localhost:${port.dev}` },
    preview: { port: port.preview, strictPort: true },
  };
};
