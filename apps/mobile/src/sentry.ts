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
 * The SDK is 8.x although Expo 57 pins `~7.11.0`, and package.json's
 * `expo.install.exclude` is what stops `expo install --fix` putting it back.
 * On React Native 0.86 under iOS, `performance.timeOrigin` falls behind the
 * wall clock by every hour the machine has slept, and 7.x stamps spans from it:
 * a simulator left open for days sent navigation spans dated days in the past,
 * which Sentry accepted with a 200 and no search for "the last hour" ever
 * found. 8.25 stopped trusting that clock (getsentry/sentry-react-native#6654).
 * Errors and sessions were never affected - they are stamped with `Date.now()`.
 *
 * The `@sentry/react-native` config PLUGIN, which uploads the JS source maps
 * and dSYMs of a Release build, is added by ../app.config.ts only when
 * SENTRY_AUTH_TOKEN is set - the switch the web's upload hangs off. Always on,
 * it adds an Xcode build phase that FAILS the build on every machine that has
 * not been given credentials. Reporting works without it; what you lose is a
 * readable stack.
 */

/*
 * Each screen under ./app is exported through `Sentry.withProfiler`, which adds
 * a span for the screen's mount, and one for how long it stayed rendered, to
 * whatever navigation transaction is open. The React Native SDK instruments
 * requests on its own and nothing inside a component, so without it a
 * navigation span says how long the screen took and not whether React was the
 * reason. Without a client the wrapper records nothing, so unlike `Sentry.wrap`
 * it needs no `sentryEnabled` check.
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
    // A profile is the sampled call stack under a transaction - Hermes's for the
    // JS, the platform's for the native threads - so the trace says the screen
    // took 800ms and the profile says which functions spent them. The web's
    // twin is `browserProfilingIntegration`. A fraction OF the sampled
    // transactions, so it can never profile more than `tracesSampleRate` keeps.
    //
    // The per-transaction rate rather than `_experiments.profilingOptions`,
    // which is the web's `trace` lifecycle but still marked experimental here.
    profilesSampleRate: 1,
    // What ties a mobile span to the .NET service's span on the other side of
    // the request: without an origin listed, the SDK attaches no
    // `sentry-trace` header and the two halves are two traces.
    tracePropagationTargets: [process.env.EXPO_PUBLIC_API_URL ?? ""],
    integrations: [
      navigationIntegration,
      // `traceFetch` by hand, because the SDK's own guess is wrong here. Expo
      // 57 replaces the global fetch with `expo/fetch`, which goes straight to
      // native and never touches the XMLHttpRequest the SDK traces by default.
      // The SDK switches to tracing fetch when it recognises `expo/fetch` by a
      // `Symbol.for("expo.builtin")` marker, and the fetch this app ends up
      // with does not carry it: measured, `traceFetch` came out false, no
      // request had a span or sent a `sentry-trace` header, and every
      // `GET /api/account` started a trace of its own on the .NET side.
      Sentry.reactNativeTracingIntegration({ traceFetch: true }),
      // Masks every text, image and vector by default - the line the web's
      // replay draws, for the same name and phone number on the account screen.
      Sentry.mobileReplayIntegration(),
    ],
    // A replay only for a session that errs, as on the web: the SDK keeps the
    // last minute on the device and sends it with the error, so every issue
    // has one and a quiet session sends nothing.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1,
    // The same line the web draws (`dataCollection.userInfo` there): what the
    // form does is worth reporting, who filled it in is not.
    sendDefaultPii: false,
    /*
     * Structured logs - the `Sentry.logger.*` calls. Opt-in here where the web
     * sends them always: this SDK is still on `@sentry/core` 10, which wants
     * `enableLogs: true`, and v11 is what removed the flag
     * (apps/shell/src/sentry.ts). Without it every `Sentry.logger` call is a
     * silent no-op. Each log is stamped with the span current when it ran, so
     * it reads inside that trace next to the spans.
     *
     * `console.*` stays out. On by default once logs are, it would ship every
     * React warning and library chatter as a log line with no attributes to
     * search by - and the error-level ones already reach the issue as
     * breadcrumbs. A log here is a line somebody chose to write.
     */
    enableLogs: true,
    enableAutoConsoleLogs: false,
    // Logs have no sample rate, so this is the only volume control: `debug`
    // and `trace` are for watching a device during development, not for a
    // release build.
    beforeSendLog: (log) =>
      !__DEV__ && (log.level === "debug" || log.level === "trace") ? null : log,
  });
}
