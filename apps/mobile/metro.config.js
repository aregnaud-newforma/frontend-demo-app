/**
 * Expo's default Metro config, with Datadog's serializer on top: it stamps each
 * bundle with a debug ID and writes the same ID into its source map, which is
 * what Datadog matches an uploaded map to a crash by. Without it the maps the
 * `expo-datadog` plugin uploads (app.config.ts) are matched by nothing, and a
 * JS stack trace in Datadog stays minified.
 *
 * It changes the bundle's LAST line and nothing else, so it is here whether or
 * not an upload is configured - a bundle does not change shape with whoever
 * holds a key, the rule vite.base.ts keeps for the web.
 */
const { getDatadogExpoConfig } = require("@datadog/mobile-react-native/metro");

module.exports = getDatadogExpoConfig(__dirname);
