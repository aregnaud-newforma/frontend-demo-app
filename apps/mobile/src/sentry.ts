import * as Sentry from "@sentry/react-native";

/**
 * Error and performance reporting for the mobile app.
 *
 * Off unless `EXPO_PUBLIC_SENTRY_DSN` is set, AND off under `NODE_ENV=test`
 * whatever that variable says - the same two conditions, for the same reason,
 * as apps/shell/src/sentry.ts: a DSN sitting in .env so `expo start` reports
 * is a DSN the jest run would inherit, and the tests provoke failures on
 * purpose. A suite that reports its own fixtures as production incidents is
 * worse than no reporting.
 *
 * `EXPO_PUBLIC_` is the prefix, not `VITE_`, and it is the same idea: Expo
 * inlines those variables into the bundle at build time, and everything else in
 * the environment stays on the machine that built it.
 *
 * Deliberately smaller than the web's init. There is no multiplexed transport
 * because there are no remotes to tell apart - the whole reason this app is one
 * build (docs/adr/0007) - and no router instrumentation hand-off, because
 * `reactNavigationIntegration` is fed the navigation container by
 * ../src/app/_layout.tsx rather than wrapping a router factory.
 *
 * The SETUP is duplicated across the app's two halves the way the backend's is
 * (AGENTS.md on server/): what this file decides about sampling and PII is not
 * what apps/shell/src/sentry.ts decides, and nothing enforces that the two
 * agree.
 *
 * What is NOT here is the `@sentry/react-native` config PLUGIN, and its absence
 * is the same decision the web makes with SENTRY_AUTH_TOKEN: the plugin exists
 * to upload debug symbols - dSYMs and ProGuard maps - and it adds an Xcode
 * build phase that FAILS the build when it has no organisation to upload to,
 * which is every machine that has not been given credentials. Reporting works
 * without it; what you lose until you add it back, with `organization` and
 * `project`, is a symbolicated native stack.
 */

export const navigationIntegration = Sentry.reactNavigationIntegration({
  // The tab bar and the stack push the same routes; one span per navigation is
  // what makes them comparable over time.
  enableTimeToInitialDisplay: true,
});

/**
 * Whether reporting is on at all, read once at module scope.
 *
 * Exported because `Sentry.wrap` has to follow it: the wrapper measures app
 * start against the client `init` created, and wrapping when there is no client
 * warns "`Sentry.wrap` was called before `Sentry.init`" on every launch - a
 * warning about a thing that is off ON PURPOSE, which is the kind that teaches
 * people to ignore warnings.
 */
export const sentryEnabled =
  Boolean(process.env.EXPO_PUBLIC_SENTRY_DSN) && process.env.NODE_ENV !== "test";

export function initSentry() {
  if (!sentryEnabled) return;

  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: __DEV__ ? "development" : "production",
    // Everything, because this is a demo whose whole point is the trace. A real
    // app samples; the .NET service and the notifications service downstream
    // inherit the decision from the header this SDK sends, so lowering it here
    // lowers it for all three.
    tracesSampleRate: 1,
    // What ties a mobile span to the .NET service's span on the other side of
    // the request: without an origin listed, the SDK attaches no
    // `sentry-trace` header and the two halves are two traces.
    tracePropagationTargets: [process.env.EXPO_PUBLIC_API_URL ?? ""],
    integrations: [navigationIntegration],
    // The same line the web draws (`dataCollection.userInfo` there): what the
    // form does is worth reporting, who filled it in is not.
    sendDefaultPii: false,
  });
}
