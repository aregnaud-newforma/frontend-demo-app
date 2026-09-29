import { datadogLogs } from "@datadog/browser-logs";
import { datadogRum } from "@datadog/browser-rum";
import { reactPlugin } from "@datadog/browser-rum-react";
import { ownerOfStack } from "./datadog-owner";
import { remoteLoadMeasure } from "./remote-load-timing";

const applicationId = import.meta.env.VITE_DATADOG_APPLICATION_ID;
const clientToken = import.meta.env.VITE_DATADOG_CLIENT_TOKEN;
const credentials =
  applicationId && clientToken && import.meta.env.MODE !== "test"
    ? { applicationId, clientToken }
    : undefined;

/** Whether Datadog runs at all - and so whether it, not Sentry, profiles the page. */
export const datadogEnabled = credentials !== undefined;

/**
 * Datadog RUM and browser logs, run BESIDE ./sentry.ts rather than instead of
 * it, so the two can be compared on the same sessions. Each is switched on by
 * its own variables, and the profiler is the one thing they do not both run.
 *
 * Off unless `VITE_DATADOG_APPLICATION_ID` and `VITE_DATADOG_CLIENT_TOKEN` are
 * both set, and off in `test` whatever they say - the two conditions
 * `initSentry` has, for the reason it gives: Vite loads .env in every mode, and
 * the browser tests provoke failures on purpose.
 *
 * Called from ../routes.tsx next to `initSentry`, before the router is built:
 * ./rum-views.ts starts a RUM view for the first route as the router is
 * created, and `reactPlugin({ router: true })` is what tells RUM to wait for
 * those views instead of starting its own from the URL.
 *
 * `propagateTraceBaggage: false` is what lets the two coexist on a request.
 * Datadog 7 writes a `baggage` header by default, and Sentry already writes
 * one to carry its sampling decision to the account API; two SDKs appending
 * to the same header leaves the backend to untangle them. Sentry keeps
 * `baggage`, and Datadog has `traceparent` to itself.
 *
 * `allowedTracingUrls` is what writes that `traceparent`, on every call to the
 * account API, so a RUM resource and the backend trace it started are one
 * thing in Datadog. W3C only, because the API continues it through
 * OpenTelemetry and reads nothing else (server/Accounts/DatadogSetup.cs). Only
 * `/api/` on this origin: the Vite proxy forwards those, and a header on any
 * other origin would trip a CORS preflight the remotes never answer.
 *
 * `profilingSampleRate: 100` profiles every session, INSTEAD of Sentry: two
 * profilers sampling one page through the same JS Self-Profiling API would
 * make both overheads look worse than either is alone, so ./sentry.ts reads
 * `datadogEnabled` and leaves its own profiler out whenever this one runs.
 * The browser profiles nothing unless index.html was served with
 * `Document-Policy: js-profiling`, which ../vite.config.ts sends.
 *
 * Session replay is Datadog's alone - Sentry records none here - so one
 * session in five is recorded, the rate Datadog's own setup suggests.
 * `defaultPrivacyLevel: "mask"` hides every piece of text on the page, not only
 * what is typed into a field, which is the SDK's default: the account page
 * DISPLAYS a person's name and phone number, and a replay would otherwise carry
 * them - the reason ./sentry.ts gives for sending no user info either.
 */
export function initDatadog() {
  if (!credentials) return;
  const { applicationId, clientToken } = credentials;

  // `datadoghq.eu` for an EU organisation; the SDK's default is the US site,
  // and a token sent to the wrong one is refused without a word in the console.
  const site = import.meta.env.VITE_DATADOG_SITE || "datadoghq.com";
  // Named for the web app rather than the shell: the remotes report through
  // this same init, and this is where their views - and any event no build's
  // stamp claims - stay. An error, fetch or long task from a remote's own code
  // is filed under that remote's service instead, by the stamps
  // ../../../vite.base.ts's `datadogPlugin` puts in its chunks. The same string
  // as `shellDatadogService` there, which stamps the shell's own chunks.
  const service = "demo-web-frontend";
  const env = import.meta.env.MODE;
  // The version every build's stamps carry (../../../vite.base.ts), so the
  // shell's events and a remote's name the same build.
  const version = APP_VERSION;

  datadogRum.init({
    applicationId,
    clientToken,
    site,
    service,
    env,
    version,
    sessionReplaySampleRate: 20,
    profilingSampleRate: 100,
    defaultPrivacyLevel: "mask",
    plugins: [reactPlugin({ router: true })],
    // What `startOperation` and its stops need, or the SDK drops them without
    // a word: operations are experimental in the browser SDK. The one in
    // ../../home/src/HomePage.tsx is the reason.
    enableExperimentalFeatures: ["feature_operation_vital"],
    propagateTraceBaggage: false,
    allowedTracingUrls: [
      {
        match: (url: string) => url.startsWith(`${location.origin}/api/`),
        propagatorTypes: ["tracecontext"],
      },
    ],
    // A fetch or XHR a remote sent, under that remote's service - on the event
    // itself, since a service in the custom context is an attribute no filter
    // sees. ./datadog-owner.ts says why the SDK's own attribution misses these.
    beforeSend: (event, context) => {
      if (event.type === "resource" && "handlingStack" in context && context.handlingStack) {
        const owner = ownerOfStack(
          context.handlingStack,
          window.DD_SOURCE_CODE_CONTEXT ?? {},
          service,
        );
        if (owner) {
          event.service = owner.service;
          event.version = owner.version ?? event.version;
        }
      }
      return true;
    },
  });

  // Each remote's load time as a duration vital: ./remote-load-timing.ts
  // measures it, and this is where it becomes Datadog's. `buffered` delivers
  // the loads measured before the observer existed as well.
  new PerformanceObserver((list) => {
    const loads = list
      .getEntriesByName(remoteLoadMeasure)
      .filter((entry) => entry instanceof PerformanceMeasure);
    for (const load of loads) {
      datadogRum.addDurationVital(remoteLoadMeasure, {
        startTime: performance.timeOrigin + load.startTime,
        duration: load.duration,
        context: load.detail,
      });
    }
  }).observe({ type: "measure", buffered: true });

  datadogLogs.init({ clientToken, site, service, env, version });
}
