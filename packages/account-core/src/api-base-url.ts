/**
 * Where `/api/account` lives, for the two runtimes that ask.
 *
 * On the WEB there is nothing to configure: the page and the API share an
 * origin (apps/shell/vite.config.ts proxies /api in dev, a reverse proxy does
 * it in production), so `window.location.origin` is the answer in the app,
 * under Playwright and under Vitest Browser Mode alike - each of which serves
 * from a different port, which is why the origin is read at call time rather
 * than baked in.
 *
 * On REACT NATIVE there is no `window`, and no origin to borrow either: the
 * bundle runs on a device and the API is somewhere on the network. So the host
 * says once, at startup, and every request made afterwards uses it.
 *
 * A module variable rather than a parameter threaded through `getAccount` and
 * `updateAccount`: the base URL is a property of the PROCESS, not of a call,
 * and passing it down would put it in the signature of every caller including
 * the components, which have no way of knowing it.
 */
let configured: string | undefined;

/**
 * Called once, before the first request, by a host with no `window` -
 * apps/mobile does it in its root layout. Calling it on the web is allowed and
 * would override the origin; nothing does.
 */
export function setApiBaseUrl(baseUrl: string) {
  configured = baseUrl;
}

export function apiBaseUrl(): string {
  if (configured) return configured;

  if (typeof window === "undefined") {
    throw new Error(
      "No API base URL: a host without `window` has to call setApiBaseUrl() before the first request.",
    );
  }

  return window.location.origin;
}
