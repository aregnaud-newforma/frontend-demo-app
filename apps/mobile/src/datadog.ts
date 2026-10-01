import {
  DatadogProviderConfiguration,
  DdRum,
  PropagatorType,
  TrackingConsent,
} from "@datadog/mobile-react-native";
import Constants from "expo-constants";
import { useIsFocused } from "expo-router";
import { useEffect } from "react";

/**
 * Datadog RUM for the app, BESIDE ./sentry.ts rather than instead of it - the
 * mobile twin of apps/shell/src/datadog.ts, so the two tools can be compared on
 * the same sessions here as well. Neither knows the other is there, and each
 * is switched on by its own variables.
 *
 * Off unless `EXPO_PUBLIC_DATADOG_APPLICATION_ID` and
 * `EXPO_PUBLIC_DATADOG_CLIENT_TOKEN` are both set, and off under jest whatever
 * they say - the two conditions `sentryEnabled` has, for the reason it gives.
 * The application is the React Native one, not the web's: Datadog groups a
 * native crash, its dSYM and its source map by application.
 *
 * Exported as a configuration rather than started here, because the SDK's
 * `DatadogProvider` starts it: ./app/_layout.tsx wraps the tree in one when
 * this is not `undefined`.
 */
const applicationId = process.env.EXPO_PUBLIC_DATADOG_APPLICATION_ID;
const clientToken = process.env.EXPO_PUBLIC_DATADOG_CLIENT_TOKEN;
// The API's host, which is what `firstPartyHosts` matches a request by.
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
const apiHost = apiUrl ? new URL(apiUrl).hostname : undefined;
const extraVersion: unknown = Constants.expoConfig?.extra?.appVersion;
const appVersion = typeof extraVersion === "string" ? extraVersion : undefined;

export const datadogConfiguration =
  applicationId && clientToken && process.env.NODE_ENV !== "test"
    ? new DatadogProviderConfiguration(
        clientToken,
        // The words ./sentry.ts and the web use, so one environment is one
        // environment in both tools.
        __DEV__ ? "development" : "production",
        // Consent is the app's to ask for, and this demo has no screen that
        // asks. A real app starts at PENDING and grants it from its own UI.
        TrackingConsent.GRANTED,
        {
          // `EU1` for an EU organisation. The SDK defaults to the US site, and
          // a token sent to the wrong one is refused without a word.
          site: process.env.EXPO_PUBLIC_DATADOG_SITE || "US1",
          // Named after the Sentry project this app reports to, as the web's
          // is, so one name finds the app in either tool.
          service: "demo-mobile-frontend",
          // The commit, as the web and the backend report it - ../app.config.ts
          // puts it in the manifest, and files the native uploads under it too.
          // Unset, the SDK falls back to app.json's `1.0.0`.
          version: appVersion,
          rumConfiguration: {
            applicationId,
            trackInteractions: true,
            trackResources: true,
            trackErrors: true,
            // The same reason ./sentry.ts forces `traceFetch`: Expo 57 replaces
            // the global fetch with a native one that never goes through the
            // XMLHttpRequest the SDK watches by default, so without this no
            // call to the API would be a RUM resource at all.
            trackFetchResources: true,
            nativeCrashReportEnabled: true,
            // JS long tasks - the JS thread held for longer than this - in the
            // view's timeline, the way Sentry's slow and frozen frames are in
            // its screen spans. OFF by default (`0`), unlike the native ones,
            // which the SDK reports from 200ms without being asked; 100ms is
            // the lowest the SDK accepts, and a demo has no traffic to drown.
            longTaskThresholdMs: 100,
            // What ties a RUM resource to the backend trace it started - the
            // web's `allowedTracingUrls`, and for the same API. W3C only,
            // because the account API continues it through OpenTelemetry and
            // reads nothing else (server/Accounts/DatadogSetup.cs), and because
            // `baggage` belongs to Sentry.
            firstPartyHosts: apiHost
              ? [{ match: apiHost, propagatorTypes: [PropagatorType.TRACECONTEXT] }]
              : [],
            resourceTraceSampleRate: 100,
          },
          /*
           * Present, even with nothing but the mapper in it, because its
           * presence is the switch: the native SDK enables Logs only when it
           * is given one, and `DdLogs` calls without it are dropped on the
           * device. Each log is tied to the RUM session and view it ran in by
           * default, which is what opens it from the session.
           *
           * The mapper is the twin of `beforeSendLog` in ./sentry.ts, for the
           * same reason: `debug` is for watching a device, not for a release.
           */
          logsConfiguration: {
            logEventMapper: (log) => (!__DEV__ && log.status === "debug" ? null : log),
          },
        },
      )
    : undefined;

/**
 * Tells Datadog the screen is loaded, the first time it is both `ready` and
 * on screen: the view's `loading_time`, measured from the RUM view
 * ./app/_layout.tsx started for it. The twin of the time to display Sentry
 * measures on its own - Datadog has no way to know what "loaded" means for a
 * screen, so the screen says it.
 *
 * `ready` is the screen's own answer: its data on screen, or `true` for a
 * screen with none. `false` to the SDK so the first report stands - a refetch
 * that re-renders the screen is not the screen loading again.
 *
 * FOCUSED as well as ready, because mounted is not the same as visited: the
 * tabs mount every screen at launch, so a screen whose data was already cached
 * was ready before anyone opened it - measured, the account screen reported
 * at launch to the view of the home screen, and the visit to it two minutes
 * later had nothing left to report. Focus is what a visit is, and it comes
 * back on the next visit, so a tab opened twice reports twice.
 *
 * Reported on the NEXT FRAME rather than in the effect: the frame is when
 * the screen is displayed, which is what Sentry's time to display waits for
 * too, and by then the layout has started the view - expo-router updates the
 * route, which the layout starts the view from, a commit after the screen
 * gains focus.
 *
 * Held until the SDK has started and a no-op when it never does, like the
 * `startView` it measures from.
 */
export function useViewLoaded(ready: boolean) {
  const focused = useIsFocused();

  useEffect(() => {
    if (!ready || !focused) return;

    const frame = requestAnimationFrame(() => void DdRum.addViewLoadingTime(false));
    return () => cancelAnimationFrame(frame);
  }, [ready, focused]);
}
