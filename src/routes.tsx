import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AccountPage } from "@account/AccountPage";
import { EditAccountPage } from "@account/EditAccountPage";
import { ActivityPage } from "@activity/ActivityPage";
import { HomePage } from "@home/HomePage";
import { RootLayout } from "@layout/RootLayout";

/**
 * The whole route tree, written out rather than generated.
 *
 * Code-based routing on purpose: a file-based tree would add a Vite plugin and
 * a committed `routeTree.gen.ts` that has to stay in sync with the filenames.
 * For three routes, the tree is shorter read as code than inferred from paths -
 * and nothing generated lands in the repo, which is the same reason the browser
 * tests do not write screenshots.
 *
 * Data loading is deliberately NOT here. Routes could fetch through `loader`,
 * but then the account would arrive by a route mechanism and the components
 * could no longer be rendered - or tested - on their own. Keeping react-query
 * inside the components is what lets eleven integration tests mount the form
 * with no router in the tree at all.
 */

const rootRoute = createRootRoute({ component: RootLayout });

/**
 * "/" is a page now, not a forward. It used to `throw redirect({ to: "/account" })`
 * because there was nothing to land on; the welcome is that something, and the
 * nav in RootLayout is how you leave it.
 */
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account",
  component: AccountPage,
});

const editAccountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/account/edit",
  component: EditAccountPage,
});

const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activity",
  component: ActivityPage,
});

/**
 * Exported so the integration tests can build their own router over the same
 * tree with a memory history - the pages navigate, so testing one means giving
 * it somewhere to navigate TO. A fresh router per test, like the fresh
 * QueryClient, so no test inherits another's history.
 */
export const routeTree = rootRoute.addChildren([
  indexRoute,
  accountRoute,
  editAccountRoute,
  activityRoute,
]);

export const router = createRouter({ routeTree });

/**
 * Registering the router's type globally is what makes `<Link to="...">` and
 * `navigate({ to: "..." })` check their paths: a typo in a route string is a
 * compile error, not a click that goes nowhere.
 */
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
