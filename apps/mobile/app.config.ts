import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * app.json, plus the one plugin that depends on who is building.
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
  ],
});
