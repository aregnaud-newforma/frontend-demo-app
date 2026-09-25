import type { CSSOptions, PluginOption, UserConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { federation } from "@module-federation/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import {
  dts,
  remoteEntry,
  remoteRef,
  remotes,
  shared,
  type RemoteName,
} from "./federation.config.ts";
import { fromRoot, stylexBabelPlugin, stylexPostcss } from "./stylex.config.ts";

/**
 * What the shell build and every remote build have in common: the same
 * toolchain, differing only in which app it is pointed at. Held here so a
 * plugin added to one build cannot be forgotten in another - the way
 * ./stylex.config.ts holds the StyleX options. vitest.config.ts declares its
 * own copy of the plugin list: Browser Mode serves through its own pipeline
 * and takes no `vite.config.ts`.
 *
 * At the repository root rather than in a package: each app's vite.config.ts
 * reaches it relatively, which Vite's config loader always bundles, while a
 * bare specifier can be externalised and handed to Node as raw TypeScript.
 */

// The browsers this app is built for, restated in esbuild's own vocabulary.
// Vite does not read `browserslist` — `build.target` takes esbuild names
// (`safari16.4`), not browserslist queries (`safari >= 16.4`), and a
// `browserslist` field is ignored in silence. So the floor is declared twice:
// here for what Vite emits, and in package.json for every tool that does read
// browserslist.
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

/** The shell's Sentry project, and every build's until it is given its own. */
const defaultSentryProject = {
  project: "demo-web-shell-frontend",
  dsn: process.env.VITE_SENTRY_DSN,
};

/**
 * A remote's own Sentry project - `demo-web-<name>-frontend`, opted into by
 * setting `SENTRY_DSN_<NAME>` (see .env.example) - so its errors land in an
 * issue stream its team owns, with releases and source maps of its own. Unset,
 * the remote reports into the shell's project like everything else: nothing
 * to create in Sentry before a remote can build, and nothing that breaks the
 * build when a project does not exist yet.
 */
const sentryProjectFor = (name: RemoteName) => {
  const dsn = process.env[`SENTRY_DSN_${name.toUpperCase()}`];
  return dsn ? { project: `demo-web-${name}-frontend`, dsn } : defaultSentryProject;
};

/**
 * `moduleMetadata` is the micro-frontend half of the plugin: it stamps every
 * bundle of THIS build with the DSN and release of this build's project, so
 * that at runtime a stack frame can say which build it came from. The shell's
 * SDK reads the stamps back in src/sentry-owner.ts and sends the error to
 * that project. Stamped whether or not the project is the remote's own - a
 * stamp carrying the default DSN routes to the default, which is the same as
 * no stamp, and keeps every build's frames attributable in the same way.
 */
export const sentrySourcemaps = (
  outDir: string,
  { project, dsn }: { project: string; dsn?: string },
): PluginOption[] =>
  sentryAuthToken
    ? [
        sentryVitePlugin({
          org: "alexisregnaud",
          project,
          url: "https://de.sentry.io",
          authToken: sentryAuthToken,
          sourcemaps: { filesToDeleteAfterUpload: [`./${outDir}/**/*.map`] },
          moduleMetadata: ({ release }) => ({ dsn, release }),
        }),
      ]
    : [];

export const shellSentryProject = defaultSentryProject;

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
  // Its OWN dist/, inside apps/<name>/, not a shared dist/<name> at the root.
  // Turborepo restores a cache entry by overwriting the task's declared
  // outputs, so three builds writing into one directory would have one
  // restore clobber another's artefacts.
  const outDir = "dist";
  const port = remotes[name];
  const consumed = Object.fromEntries(
    consumes.map((remote) => [remote, remoteRef(remote, command)]),
  );

  return {
    // public/ is the shell's: index.html's favicon, the MSW worker the tests
    // register. A remote serves what it exposes and nothing else.
    publicDir: false,
    // No `cacheDir` override any more. It was here because three builds shared
    // one Vite root and therefore one node_modules/.vite: each wrote
    // pre-bundled dependencies carrying ITS federation ids, and the last to
    // write won for all. Each app is its own root now, so the default is
    // already one cache per build.
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
      ...sentrySourcemaps(outDir, sentryProjectFor(name)),
    ],
    // Absolute, because this build runs with apps/<name>/ as its cwd and the
    // tokens are outside it - ../stylex.config.ts's `fromRoot` says why a
    // relative pattern would match nothing without failing.
    css: stylexCss([
      fromRoot(`apps/${name}/src/**/*.{ts,tsx}`),
      fromRoot("packages/tokens/tokens.stylex.ts"),
    ]),
    server: { port: port.dev, strictPort: true, origin: `http://localhost:${port.dev}` },
    preview: { port: port.preview, strictPort: true },
  };
};
