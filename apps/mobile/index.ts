/**
 * The entry point, and the one place the ORDER of three imports matters.
 *
 * `./unistyles` calls `StyleSheet.configure`, and every `StyleSheet.create` in
 * the app is evaluated at module scope - so the configuration has to happen
 * before the router starts importing screens. `./src/api-config` says where the
 * API is, for the same reason: a screen that rendered first could fire a query
 * with no base URL to build the request from. `expo-router/entry` is what does
 * that importing, which is why it is last and why this file exists at all
 * rather than the router being the `main` of package.json.
 */
import "./unistyles";
import "./src/api-config";
import "expo-router/entry";
