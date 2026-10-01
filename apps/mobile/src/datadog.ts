import {
  DatadogProviderConfiguration,
  PropagatorType,
  TrackingConsent,
} from "@datadog/mobile-react-native";

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
        },
      )
    : undefined;
