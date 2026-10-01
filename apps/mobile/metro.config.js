/**
 * Expo's default Metro config, with Datadog's serializer on top and Sentry's
 * around both: each stamps the bundle with a debug ID and writes the same ID
 * into its source map, which is what each tool matches an uploaded map to a
 * crash by. Without them the maps the `expo-datadog` and `@sentry/react-native`
 * plugins upload (app.config.ts) are matched by nothing, and a JS stack trace
 * stays minified.
 *
 * Nested, the two agree on ONE id - measured on an `expo export`: both
 * runtime registries, the bundle's `//# debugId=` comment and the map's
 * `debugId` all carry the same uuid - so one map serves both uploads.
 *
 * It changes the bundle's first and last lines and nothing else, so it is here
 * whether or not an upload is configured - a bundle does not change shape with
 * whoever holds a key, the rule vite.base.ts keeps for the web.
 */
const { getDatadogExpoConfig } = require("@datadog/mobile-react-native/metro");
const { withSentryConfig } = require("@sentry/react-native/metro");

module.exports = withSentryConfig(getDatadogExpoConfig(__dirname));
