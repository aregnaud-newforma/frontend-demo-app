import * as Sentry from "@sentry/react";
import { router } from "./routes";

/**
 * Error and performance reporting, wired to the router rather than to the URL.
 *
 * `tanstackRouterBrowserTracingIntegration` takes the router instance so a
 * pageload or navigation span is named by its ROUTE (`/account/edit`) and not by
 * the path that was visited. With a parameterised route that distinction is the
 * difference between one span you can compare over time and one per id; this
 * app has no params yet, and naming them by route now is what keeps the first
 * one from splitting the data.
 *
 * Off unless `VITE_SENTRY_DSN` is set, which is what keeps `yarn dev` and the
 * browser tests from reporting. The integration suite runs real Chromium
 * (vitest.config.ts), so an unconditional `init` would send every deliberate
 * failure a test provokes - the API-is-down cases especially - to the project as
 * if production had broken.
 *
 * `dataCollection.userInfo` is off by choice. Sentry v11 flipped this default:
 * v10 collected nothing personal unless `sendDefaultPii: true` said so, v11
 * collects it unless told otherwise, and the app's subject is somebody's account
 * details. The stack trace is what debugs the error; the IP address behind it is
 * not, so it is not sent.
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    // `vite build` says "production", `vite dev` says "development", so the two
    // are separable in Sentry without a second variable to keep in step.
    environment: import.meta.env.MODE,
    integrations: [Sentry.tanstackRouterBrowserTracingIntegration(router)],
    // Every transaction, because this is a demo with demo traffic. A real app
    // samples here, or swaps in `tracesSampler` to keep the routes that matter.
    tracesSampleRate: 1,
    dataCollection: { userInfo: false },
  });
}
