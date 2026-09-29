import { datadogRum } from "@datadog/browser-rum";
import { matchRoutes, type DataRouter, type Location } from "react-router";

/**
 * Starts a Datadog RUM view for every page the router shows, from the moment
 * the navigation to it BEGINS rather than from the moment its URL commits.
 *
 * In place of the `createBrowserRouter` from `@datadog/browser-rum-react`,
 * which starts a view when `location.pathname` changes. A data router resolves
 * a route's `lazy` before it commits the URL, so with that wrapper every chunk
 * of a remote landed in the PREVIOUS page's view: on `/` -> `/account`, the
 * account remote's code was filed under `/`, and the `/account` view held a
 * lone API call and a loading time that began 150ms after the click. Starting
 * the view from the router's loading phase puts the remote's chunks, and the
 * time they take, in the view of the page they are for.
 *
 * `url` is the destination's: at that moment the address bar still shows the
 * page being left, and a view named `/account` should not report `/` as its
 * URL. Datadog resolves it against the current location, so a path is enough.
 *
 * A navigation with no loading phase - a route already loaded, the back and
 * forward buttons - starts its view at the commit instead, which is as early
 * as anything knows about it. One interrupted before its commit leaves the
 * app where it was, under a view named for where it was going; the commit
 * that follows starts a view for the page actually on screen.
 *
 * Views are keyed by pathname, as the wrapper's were: a query-string change
 * is the same page. `reactPlugin({ router: true })` in ./datadog.ts is still
 * what switches the SDK to views started by hand; nothing else starts them.
 *
 * Called once, as the router is created, which starts the first view - and it
 * must be the only one at startup: a second `startView` replaces the initial
 * view, and the page-load timings (FCP, LCP) go with it.
 */
export function trackRumViews(router: DataRouter) {
  let viewPathname = router.state.location.pathname;

  const startView = (location: Location, matches: RouteMatches) =>
    datadogRum.startView({ name: viewName(matches), url: router.createHref(location) });

  startView(router.state.location, router.state.matches);

  return router.subscribe(({ navigation, location, matches }) => {
    const arriving = navigation.location;

    if (arriving && arriving.pathname !== viewPathname) {
      startView(arriving, matchRoutes(router.routes, arriving) ?? []);
      viewPathname = arriving.pathname;
    } else if (!arriving && location.pathname !== viewPathname) {
      startView(location, matches);
      viewPathname = location.pathname;
    }
  });
}

type RouteMatches = readonly { route: { path?: string } }[];

/**
 * The route that matched, as a path template - `/account/edit`, not whatever
 * URL was visited - so every visit to a page is one view name. Pathless routes
 * (the layout, the error boundary in ./routes.tsx) add nothing; a relative
 * path is joined to its parent's. The tree has no splat routes, which the
 * wrapper used to expand.
 */
function viewName(matches: RouteMatches) {
  let name = "/";
  for (const { route } of matches) {
    if (!route.path) continue;
    name = route.path.startsWith("/") ? route.path : `${name.replace(/\/$/, "")}/${route.path}`;
  }
  return name;
}
