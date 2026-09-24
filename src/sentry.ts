import * as Sentry from "@sentry/react";
import { reactRouterBrowserTracingIntegration } from "@sentry/react/react-router";
import { ownerOf } from "./sentry-owner";

/**
 * Error and performance reporting, started by ./routes.tsx rather than by the
 * entry point.
 *
 * That is not where it reads like it belongs, and the order is why: routes.tsx
 * wraps `createBrowserRouter` at module scope, Sentry requires the SDK to be up
 * before that wrapper runs, and a call in ./main.tsx would be too late - every
 * import there, route tree included, is evaluated before its first statement.
 * The one place that can guarantee "after init" is the module that does the
 * wrapping, so that module is the one that calls this.
 *
 * `reactRouterBrowserTracingIntegration` from the `@sentry/react/react-router`
 * entry point rather than the one on the package root: same integration, except
 * that this one resolves `useLocation`, `useNavigationType` and `matchRoutes`
 * out of `react-router` itself instead of having them handed in. One import in
 * place of five, and no chance of passing the hooks of a router version the app
 * no longer uses.
 *
 * Off unless `VITE_SENTRY_DSN` is set, AND off in `test` whatever that variable
 * says. Two conditions, because the first one alone does not hold: Vite loads
 * .env in EVERY mode, so a DSN sitting there for `yarn dev` is a DSN the browser
 * tests get too. The integration suite runs real Chromium (vitest.config.ts) and
 * provokes failures on purpose - a route that throws, an API that is down - and
 * with the DSN alone gating this, those were reported as if production had
 * broken. Measured, not feared: `Error: route exploded` from
 * ../layout/__tests__/RouteErrorBoundary.integration.test.tsx reached the
 * project as FRONTEND-DEMO-APP-5. MSW does not stand in the way either - the
 * `onUnhandledRequest` in ../vitest.setup.ts PRINTS on an unhandled call, it
 * does not refuse it, and the envelope went out anyway.
 *
 * `MODE` rather than a second variable, so there is nothing to set and nothing
 * to forget: Vitest runs in `test`, `vite dev` in `development`, `vite build` in
 * `production`. The same value `environment` below is built from.
 *
 * Structured logs - the `Sentry.logger.*` calls - have no switch below, and
 * that absence is the point: v9 and v10 wanted `enableLogs: true`, v11 removed
 * the option and sends them always. `beforeSendLog` is the only control left,
 * and returning null from it is how you would drop one. Every log is stamped
 * with the trace that was current when it ran, which is what makes it read
 * inside that trace next to the spans instead of in a stream of its own.
 *
 * Note what logs are NOT subject to: `tracesSampleRate` governs traces, not
 * logs. A trace that was dropped still sends everything it logged.
 *
 * ONE init, here, for three builds. The remotes never call this: they reach
 * the client it creates through the `@sentry/react` singleton
 * (../federation.config.ts), and a second init - or a second copy of the SDK
 * at another version, which since 8.7 refuses to cooperate with the first -
 * would leave their spans and logs reporting to nothing. What tells the
 * remotes apart is the transport, not the init: `makeMultiplexedTransport`
 * sends each error to the project of the build that threw it - the one
 * `beforeSend` below names, as ./sentry-owner reads it off the stack - and
 * to this DSN when it cannot tell. `moduleMetadataIntegration` is the half
 * that puts the build's stamp on the frames for it to read. Errors only:
 * a trace crosses every build and stays in this project, the app's.
 *
 * `dataCollection.userInfo` is off by choice. Sentry v11 flipped this default:
 * v10 collected nothing personal unless `sendDefaultPii: true` said so, v11
 * collects it unless told otherwise, and the app's subject is somebody's account
 * details. The stack trace is what debugs the error; the IP address behind it is
 * not, so it is not sent.
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || import.meta.env.MODE === "test") return;

  Sentry.init({
    dsn,
    // `vite build` says "production", `vite dev` says "development", so the two
    // are separable in Sentry without a second variable to keep in step.
    environment: import.meta.env.MODE,
    integrations: [
      reactRouterBrowserTracingIntegration(),
      Sentry.browserProfilingIntegration(),
      Sentry.moduleMetadataIntegration(),
    ],
    transport: Sentry.makeMultiplexedTransport(Sentry.makeFetchTransport),
    // Where the owner is decided. Here and not in the transport, because the
    // stamps are gone by then: `moduleMetadataIntegration` puts
    // `module_metadata` on the frames for event processors and this hook to
    // read, and strips it again as the envelope is built, so a transport
    // matcher reading frames finds nothing - measured, every crash then went
    // to the default project. The transport's own contract is this key in
    // `extra`, which is why the SDK exports it.
    beforeSend(event) {
      const owners = ownerOf(event);
      if (owners.length > 0) {
        event.extra = { ...event.extra, [Sentry.MULTIPLEXED_TRANSPORT_EXTRA_KEY]: owners };
      }
      return event;
    },
    // Every transaction, because this is a demo with demo traffic. A real app
    // samples here, or swaps in `tracesSampler` to keep the routes that matter.
    tracesSampleRate: 1,
    // A profile is the sampled call stack UNDER the spans above: the trace says
    // the save took 400ms, the profile says which functions spent them.
    //
    // `trace` lifecycle rather than `manual`, which is the default: the profiler
    // runs only while a sampled root span is open, so it follows
    // `tracesSampleRate` instead of recording the whole page. Nothing to start
    // or stop by hand.
    //
    // The browser refuses to profile at all unless the DOCUMENT was served with
    // `Document-Policy: js-profiling`. ../vite.config.ts sends that header for
    // `vite dev` and `vite preview`; a deployment has to set it on whatever
    // serves index.html. Missing, this integration is simply silent - no error,
    // no profile.
    profileSessionSampleRate: 1,
    profileLifecycle: "trace",
    dataCollection: { userInfo: false },
  });

  Sentry.setUser({ id: visitorId() });
}

/** Where the id below is kept, and the name it is kept under. */
const VISITOR_KEY = "demo-visitor-id";

/**
 * An id for the browser, so an issue can say how many people hit it.
 *
 * Without a user on the event, every report is unattributable: Sentry can count
 * EVENTS but not the people behind them, so an issue one person reloaded fifty
 * times and an issue fifty people hit once read the same, and there is no way to
 * pull up everything that happened to one of them. The "users affected" column
 * is what triage is sorted by, and with nothing set it reads 0 for everything.
 *
 * A random uuid, not a name, not an email, not the account the app is about -
 * the same line `dataCollection.userInfo: false` above draws. An opaque id is
 * enough to COUNT and to GROUP, which is all the column needs, and it identifies
 * nobody outside this Sentry project. In an app with real accounts this would be
 * the account id instead, for the same reason: it links, it does not reveal.
 *
 * Kept in localStorage so the same browser stays one person across reloads. That
 * is also its limit - a new browser, or a cleared site data, is a new "user".
 */
function visitorId(): string {
  try {
    const stored = localStorage.getItem(VISITOR_KEY);
    if (stored) return stored;

    const created = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    // Storage can be refused outright - third-party contexts, hardened privacy
    // settings - and it throws when it is. A fresh id per page load still
    // counts one visit as one person; it just cannot recognise a return.
    return crypto.randomUUID();
  }
}
