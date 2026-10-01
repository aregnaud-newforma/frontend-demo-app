import { datadogLogs } from "@datadog/browser-logs";
import { datadogRum } from "@datadog/browser-rum";
import { reactPlugin } from "@datadog/browser-rum-react";

/**
 * Datadog RUM and browser logs, run BESIDE ./sentry.ts rather than instead of
 * it, so the two can be compared on the same sessions. Neither knows the other
 * is there, and each is switched on by its own variables.
 *
 * Off unless `VITE_DATADOG_APPLICATION_ID` and `VITE_DATADOG_CLIENT_TOKEN` are
 * both set, and off in `test` whatever they say - the two conditions
 * `initSentry` has, for the reason it gives: Vite loads .env in every mode, and
 * the browser tests provoke failures on purpose.
 *
 * Called from ../routes.tsx next to `initSentry`, before the router is built:
 * the Datadog `createBrowserRouter` there starts a RUM view for the first
 * route as it is created, and `reactPlugin({ router: true })` is what tells
 * RUM to wait for those views instead of starting its own from the URL.
 *
 * `propagateTraceBaggage: false` is what lets the two coexist on a request.
 * Datadog 7 writes a `baggage` header by default, and Sentry already writes
 * one to carry its sampling decision to the account API; two SDKs appending
 * to the same header leaves the backend to untangle them. Sentry keeps
 * `baggage`, and Datadog has `traceparent` and `x-datadog-*` to itself - once
 * `allowedTracingUrls` names the API, which it does not yet, because no
 * backend reports to Datadog to continue the trace.
 *
 * No `profilingSampleRate`, which leaves Datadog's profiler at its default of
 * 0. Sentry already profiles every trace through the same JS Self-Profiling
 * API, and two profilers sampling one page would make both overheads look
 * worse than either is alone. Switch Sentry's off before turning this on.
 *
 * Session replay is Datadog's alone - Sentry records none here - so one
 * session in five is recorded, the rate Datadog's own setup suggests.
 * `defaultPrivacyLevel: "mask"` hides every piece of text on the page, not only
 * what is typed into a field, which is the SDK's default: the account page
 * DISPLAYS a person's name and phone number, and a replay would otherwise carry
 * them - the reason ./sentry.ts gives for sending no user info either.
 */
export function initDatadog() {
  const applicationId = import.meta.env.VITE_DATADOG_APPLICATION_ID;
  const clientToken = import.meta.env.VITE_DATADOG_CLIENT_TOKEN;
  if (!applicationId || !clientToken || import.meta.env.MODE === "test") return;

  // `datadoghq.eu` for an EU organisation; the SDK's default is the US site,
  // and a token sent to the wrong one is refused without a word in the console.
  const site = import.meta.env.VITE_DATADOG_SITE || "datadoghq.com";
  // Named for the web app rather than the shell: the remotes report through
  // this same init, so every build's views and errors are under it.
  const service = "demo-web-frontend";
  const env = import.meta.env.MODE;
  // What the source maps were uploaded under (../../../vite.base.ts); an error
  // reported under any other version is shown minified.
  const version = APP_VERSION;

  datadogRum.init({
    applicationId,
    clientToken,
    site,
    service,
    env,
    version,
    sessionReplaySampleRate: 20,
    defaultPrivacyLevel: "mask",
    plugins: [reactPlugin({ router: true })],
    propagateTraceBaggage: false,
  });

  datadogLogs.init({ clientToken, site, service, env, version });
}
