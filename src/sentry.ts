import * as Sentry from "@sentry/react";
import { reactRouterBrowserTracingIntegration } from "@sentry/react/react-router";

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
    integrations: [reactRouterBrowserTracingIntegration()],
    // Every transaction, because this is a demo with demo traffic. A real app
    // samples here, or swaps in `tracesSampler` to keep the routes that matter.
    tracesSampleRate: 1,
    dataCollection: { userInfo: false },
  });
}
