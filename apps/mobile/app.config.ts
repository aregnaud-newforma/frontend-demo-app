import { execSync } from "node:child_process";
import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * WHICH BUILD this is: the Datadog `version` src/datadog.ts reports, by the
 * rule ../../vite.base.ts gives the web - SENTRY_RELEASE, else the commit - so
 * a session lines up with the web's and the backend's under one sha. Not
 * app.json's `version`, which stays the store's `1.0.0`.
 *
 * The native uploads of a Release build must be filed under the same string,
 * or a crash's source map is never matched to it. They read
 * DATADOG_RELEASE_VERSION rather than the app's version when it is set, and
 * Expo evaluates this file inside the `expo run:ios` / `expo run:android`
 * process whose environment Xcode and Gradle inherit - so setting it here is
 * what carries it to them. An Xcode build started by hand does not pass
 * through here, and uploads under `1.0.0`.
 */
const appVersion =
  process.env.SENTRY_RELEASE || execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
process.env.DATADOG_RELEASE_VERSION = appVersion;

/**
 * app.json, plus what depends on who is building and from which commit.
 *
 * `expo-datadog` adds build phases that upload the dSYMs, JS source maps and
 * Proguard mappings of a native Release build to Datadog. It is added only when
 * DATADOG_API_KEY is set, the switch the web's source-map upload hangs off
 * (vite.base.ts): without a key the phases would run and fail every Release
 * build, which is the reason src/sentry.ts gives for going without Sentry's
 * plugin. Everything static stays in app.json.
 *
 * The plugin is applied at `expo prebuild`, so setting or clearing the key
 * takes a `yarn mobile:prebuild` to reach the native project. Its build phases
 * read DATADOG_API_KEY and DATADOG_SITE again when Xcode runs them, from the
 * environment `expo run:ios` passes on - .env.example says where they go.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  extra: { ...config.extra, appVersion },
  plugins: [
    ...(config.plugins ?? []),
    ...(process.env.DATADOG_API_KEY
      ? [
          [
            "expo-datadog",
            {
              errorTracking: {
                // The `service` src/datadog.ts reports under. The plugin's
                // default is the bundle identifier, and a map uploaded under
                // any other service than the crash's is never matched to it.
                serviceName: "demo-mobile-frontend",
              },
            },
          ] as [string, unknown],
        ]
      : []),
    // Sentry's twin of the plugin above, on the same switch: SENTRY_AUTH_TOKEN,
    // as for the web's upload. AFTER `expo-datadog` on purpose, because Expo
    // applies the two in reverse: both rewrite Xcode's "Bundle React Native
    // code and images" phase, and only `expo-datadog` knows the other - finding
    // Sentry's script already there, it appends a second bundling of its own.
    // In the other order Sentry wraps Datadog's whole command as if it were a
    // script path, which fails every build, Debug included. Measured on the
    // generated project. The token is read again when Xcode runs the phase,
    // like Datadog's key.
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          [
            "@sentry/react-native/expo",
            { organization: "alexisregnaud", project: "demo-mobile-frontend" },
          ] as [string, unknown],
        ]
      : []),
  ],
});
