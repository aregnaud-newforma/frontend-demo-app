import { useEffect } from "react";
import { useRouteError } from "react-router";
import { datadogRum } from "@datadog/browser-rum";
import * as Sentry from "@sentry/react";
import { CrashScreen } from "./CrashScreen";

/**
 * The boundary INSIDE the router, and the reason ./AppErrorBoundary is not
 * enough on its own.
 *
 * A data router catches what a route throws before a React boundary above
 * <RouterProvider> can see it: with no `errorElement` it renders its own default
 * screen and the error stops there. React re-throws to `window.onerror` in
 * development, which hides how bad that is - in a production build it does not,
 * so a crashed page would show React Router's wording and reach Sentry never.
 * Hence `captureException` by hand: the router took the error out of the path
 * where the SDK's global handler would have found it.
 *
 * In an effect rather than during render, so a re-render cannot report the same
 * crash twice. StrictMode runs the effect twice on purpose, and `yarn dev`
 * duplicates beyond that: one throw measured three events, which the SDK's
 * Dedupe integration - on by default - did not collapse. Do not read a
 * production rate off that number. A production build reports exactly one
 * event for the same throw, measured: React drops the double-invoke there, so
 * Dedupe has nothing left to do.
 *
 * Mounted below ../routes.tsx's layout route, so the navigation survives the
 * crash and there is a way out of it that is not the back button. The gap that
 * leaves is ./RootLayout itself: if the shell throws, the error is above this
 * boundary and React Router's default screen wins. Two static landmarks is a
 * small enough surface to accept that on.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();

  // Datadog too, for the same reason: its global handler is bypassed the same way.
  useEffect(() => {
    Sentry.captureException(error);
    datadogRum.addError(error);
  }, [error]);

  /*
   * A full reload, where ./AppErrorBoundary offers `resetError`. The router
   * holds this route in its error state until something navigates, and there is
   * no state elsewhere on the page worth preserving once the page itself is the
   * thing that broke.
   */
  return <CrashScreen onRetry={() => window.location.reload()} />;
}
