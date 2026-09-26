import { execSync } from "node:child_process";
import { glob, rm } from "node:fs/promises";
import { loadEnv, type CSSOptions, type Plugin, type PluginOption, type UserConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { federation } from "@module-federation/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { datadogVitePlugin } from "@datadog/vite-plugin";
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

// The federation runtime's plugins, in every build: each build runs its own
// runtime instance, and a plugin only the shell registered would miss the
// remotes the home build fetches itself. Absolute, for the reason `fromRoot`
// gives. apps/shell/src/remote-load-timing.ts says what the one here does.
export const runtimePlugins = [fromRoot("apps/shell/src/remote-load-timing.ts")];

// Where every `vite preview` listens: IPv4 loopback, spelled out. Left to
// "localhost", Node binds ::1 alone on macOS, and a Docker container cannot
// reach the host's ::1 - the Synthetics private location in ../compose.yaml
// reaches the preview builds through host.docker.internal, which is IPv4.
// Still loopback only, so nothing on the network sees the builds; browsers and
// Node's fetch both fall back from ::1 to 127.0.0.1, so `localhost` URLs keep
// working. `vite dev` is left alone: no container needs it.
export const previewHost = "127.0.0.1";

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

/**
 * WHICH BUILD this is: the Sentry release and the Datadog `version`, one string
 * for both, so a deploy reads the same in either tool. Sentry files a build's
 * source maps under it; Datadog matches maps by debug ID (`datadogPlugin`) and
 * uses it only to say which build an event came from. CI names it
 * (`SENTRY_RELEASE` in .github/workflows/ci.yml); anywhere else it is the
 * commit, which is what the Sentry plugin would derive on its own. The shell's
 * vite.config.ts hands it to the browser as `APP_VERSION`.
 */
export const appVersion =
  process.env.SENTRY_RELEASE || execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();

// Source maps, and the uploads that make them worth generating - to Sentry, to
// Datadog, or both, keyed on each one's credential. No credential, no map.
//
// A production bundle with no map gives minified frames: `t.default` at
// column 4831, which names nothing. The maps fix that, but they are the source
// code, so shipping them alongside the bundle publishes it. The build closes
// that gap by uploading them and DELETING them from its own outDir afterwards
// (`deleteSourcemaps`) - the tools can un-minify the stack, the browser is
// served nothing extra. Its OWN outDir, not dist/ as a whole: the three builds
// each do this, and one deleting another's maps before they were uploaded would
// leave that build's frames minified with nothing to say why.
//
// `hidden` is what stops the `//# sourceMappingURL=` comment being emitted: the
// map is written, but nothing in the shipped file points at a file that is about
// to be deleted.
//
// The credentials are read from `process.env`, and package.json's `build:*`
// scripts run Vite through `node --env-file-if-exists=.env` for them - and so
// does `preview:web`, whose `preview` task builds first: Vite reads
// .env into `import.meta.env` for the CLIENT bundle and deliberately leaves
// `process.env` alone, so a token sitting in .env is invisible here without that
// flag - the build succeeds, uploads nothing, and says nothing about it. CI
// passes the same variables its own way and needs no .env at all.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
// An API key, not the client token the browser SDK is given: the client token
// can only send events, and an upload is refused with it.
const datadogApiKey = process.env.DATADOG_API_KEY;

export const sourcemap = sentryAuthToken || datadogApiKey ? ("hidden" as const) : false;

/** The shell's Sentry project, and every build's until it is given its own. */
const defaultSentryProject = {
  project: "demo-web-frontend",
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
 *
 * `url` is NOT optional. The plugin defaults to sentry.io, and this
 * organisation is hosted in the EU region, where an upload to the default host
 * is accepted by nothing.
 */
const sentryUpload = ({ project, dsn }: { project: string; dsn?: string }): PluginOption[] =>
  sentryAuthToken
    ? [
        sentryVitePlugin({
          org: "alexisregnaud",
          project,
          url: "https://de.sentry.io",
          authToken: sentryAuthToken,
          release: { name: appVersion },
          moduleMetadata: ({ release }) => ({ dsn, release }),
        }),
      ]
    : [];

/**
 * Whether the browser will start RUM - the question apps/shell/src/datadog.ts
 * answers from `import.meta.env`, asked of the same file. Not `process.env`
 * alone: only `yarn build` loads .env into it, and `yarn dev` and
 * `yarn preview` would build with RUM on and every stamp missing, each event
 * filed under the shell's service with nothing to say why. The mode only picks
 * `.env.<mode>` files, of which there are none.
 */
const rumEnabled = Boolean(
  process.env.VITE_DATADOG_APPLICATION_ID ??
  loadEnv("production", fromRoot(""), "VITE_DATADOG_").VITE_DATADOG_APPLICATION_ID,
);

/**
 * The Datadog `service` a build's events and maps are filed under - one per
 * build, so a remote's team can filter on its own. The shell's is the one
 * apps/shell/src/datadog.ts initialises the SDK with, and what an event no
 * build claims falls back to. A remote's is named like its Sentry project
 * (`sentryProjectFor`), so one name finds it in either tool. Unlike Sentry
 * there is nothing to create first: Datadog lists a service when its first
 * event arrives.
 */
export const shellDatadogService = "demo-web-frontend";
const datadogServiceFor = (name: RemoteName) => `demo-web-${name}-frontend`;

/**
 * Two jobs, one plugin.
 *
 * `sourceCodeContext` is the micro-frontend half, Datadog's counterpart to
 * Sentry's `moduleMetadata` above: it stamps every chunk of THIS build with
 * its service and version, and the SDK the shell starts reads the stamps back
 * to set `service` and `version` on each error, fetch, custom action, long task
 * and vital whose stack runs through the chunk. On the event itself, not in its
 * custom context - a service put in the context is an attribute no filter
 * sees. Views, automatic clicks and non-fetch resources carry no stack, so they
 * stay the shell's. Stamped whenever RUM runs, key or no key: the stamps need
 * no upload.
 *
 * The upload, when there is a key, matches each map to its chunk by DEBUG ID
 * rather than by `service`, `version` and URL. The stamp then carries an id
 * derived from the chunk, the upload tags the chunk's map with the same id, and
 * the SDK sends the ids of the chunks an error's stack runs through. The older
 * matching could not work here: the SDK tags every event with the service it
 * was started with, the shell's, while the stamps move the event's own
 * `service` to the remote, and Datadog looked the map up by the tag - so a
 * remote's maps under its own service left its errors minified, and under the
 * shell's they would have been filed under the wrong service. A debug ID names
 * one chunk of one build, so it has neither half of that problem, nor the
 * collision of the two remotes' `remoteEntry.js` at the same path.
 *
 * Neither without Datadog configured: the plugin also reports each build to
 * Datadog's own telemetry, which a build that uses nothing of Datadog has no
 * reason to send.
 *
 * The site comes from `VITE_DATADOG_SITE`, the variable the browser SDK reads,
 * so the upload and the events cannot be sent to two different sites.
 *
 * `logLevel: "error"` because at `warn` the plugin names, for every chunk
 * carrying a dependency, each node_modules file it cannot link to git - a
 * screenful per build that says nothing. A failed upload is still printed.
 */
const datadogPlugin = (service: string): PluginOption[] =>
  datadogApiKey || rumEnabled
    ? [
        ...datadogVitePlugin({
          logLevel: "error",
          auth: { apiKey: datadogApiKey, site: process.env.VITE_DATADOG_SITE || undefined },
          rum: { enable: true, sourceCodeContext: { service, version: appVersion } },
          ...(datadogApiKey && { sourcemaps: { debugId: true, upload: true } }),
        }),
        ...(datadogApiKey ? [quoteDatadogDebugIds] : []),
      ]
    : [];

/**
 * The upload finds a chunk's debug ID by reading `ddDebugId:"<id>"` from the
 * file, and Rolldown's minifier prints that string as a template literal, so
 * without this every build aborts its upload with "No debug ID found in any
 * minified file". `generateBundle` runs after the minifier and before anything
 * is written, and a backtick swapped for a double quote moves no column, so the
 * source maps stay exact.
 */
const quoteDatadogDebugIds: Plugin = {
  name: "quote-datadog-debug-ids",
  apply: "build",
  generateBundle(_options, bundle) {
    for (const chunk of Object.values(bundle)) {
      if (chunk.type === "chunk") {
        chunk.code = chunk.code.replace(/ddDebugId:`([0-9a-f-]{36})`/, 'ddDebugId:"$1"');
      }
    }
  },
};

/**
 * The maps' last step, once every upload has read them. Not Sentry's own
 * `filesToDeleteAfterUpload`: that deletes in the plugin's `writeBundle`,
 * while Datadog's uploads in `closeBundle`, which comes after - it would find
 * nothing to send. Rolldown runs a hook's handlers one plugin after another,
 * and `order: "post"` puts this one after Datadog's.
 */
const deleteSourcemaps = (outDir: string): Plugin => ({
  name: "delete-sourcemaps",
  apply: "build",
  closeBundle: {
    order: "post",
    async handler() {
      for await (const map of glob(`${outDir}/**/*.map`)) await rm(map);
    },
  },
});

/**
 * Every upload this build makes, the stamps that tell each tool which build a
 * frame came from, and the delete that follows them.
 */
export const sourcemapUploads = (
  outDir: string,
  sentryProject: { project: string; dsn?: string },
  datadogService: string,
): PluginOption[] => [
  ...sentryUpload(sentryProject),
  ...datadogPlugin(datadogService),
  ...(sourcemap ? [deleteSourcemaps(outDir)] : []),
];

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
      federation({
        name,
        filename: remoteEntry,
        exposes,
        remotes: consumed,
        shared,
        dts,
        runtimePlugins,
      }),
      ...sourcemapUploads(outDir, sentryProjectFor(name), datadogServiceFor(name)),
    ],
    // Absolute, because this build runs with apps/<name>/ as its cwd and the
    // tokens are outside it - ../stylex.config.ts's `fromRoot` says why a
    // relative pattern would match nothing without failing.
    css: stylexCss([
      fromRoot(`apps/${name}/src/**/*.{ts,tsx}`),
      fromRoot("packages/tokens/tokens.stylex.ts"),
    ]),
    server: { port: port.dev, strictPort: true, origin: `http://localhost:${port.dev}` },
    preview: { host: previewHost, port: port.preview, strictPort: true },
  };
};
