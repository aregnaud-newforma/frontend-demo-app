import { createBrowserRouter, type RouteObject } from "react-router";
import { wrapCreateBrowserRouter } from "@sentry/react";
import { PageLoading } from "@layout/PageLoading";
import { RootLayout } from "@layout/RootLayout";
import { RouteErrorBoundary } from "@layout/RouteErrorBoundary";
import { initSentry, routerInstrumentation } from "./sentry";

/*
 * Before `wrapCreateBrowserRouter` at the bottom of this file, which is Sentry's
 * own instruction - "call this AFTER Sentry.init()" - and the reason the call
 * lives here rather than in ./main.tsx. ../sentry.ts says the rest.
 */
initSentry();

/**
 * The whole route tree, written out rather than generated.
 *
 * Data mode on purpose - plain route objects handed to `createBrowserRouter`,
 * not framework mode. Framework mode would add a Vite plugin and a generated
 * `.react-router/types` directory that has to stay in sync with the filenames.
 * For three routes, the tree is shorter read as code than inferred from paths -
 * and nothing generated lands in the repo, which is the same reason the browser
 * tests do not write screenshots.
 *
 * The cost of that choice is worth naming: framework mode is where React Router
 * types `<Link to="...">`, so here a typo in a path is a click that goes
 * nowhere rather than a compile error. `@layout/Navigation` and the integration
 * tests are what catch it instead.
 *
 * Data loading is deliberately NOT here. Routes could fetch through `loader`,
 * but then the account would arrive by a route mechanism and the components
 * could no longer be rendered - or tested - on their own. Keeping react-query
 * inside the components is what lets eleven integration tests mount the form
 * with no router in the tree at all.
 *
 * The PAGES are not here either. `account/pages` is a remote - a separate
 * build, served from its own origin, fetched when a route first needs it
 * (../federation.config.ts, docs/adr/0003) - and `lazy` is how a data router
 * asks for a route's component on demand rather than at startup. The URL is
 * the whole contract between the shell and a remote: this file says WHERE a
 * page lives, the remote says WHAT it is, and neither imports the other's
 * state. A remote that fails to load - its server down, a bad deploy - rejects
 * this promise, which the router hands to the `errorElement` below like any
 * other route error: the page fails, the navigation around it stands.
 *
 * `lazy` takes the object form, one loader per property, so the route knows
 * ahead of time that it has no `loader` and can skip the round-trip a function
 * form would need to find that out.
 */
export const createRoutes = (): RouteObject[] => [
  {
    // Pathless, so the shell wraps every route without owning a URL segment.
    Component: RootLayout,
    children: [
      {
        /*
         * Pathless for a second reason: to own the `errorElement`. It belongs
         * BELOW the layout, so a page that throws keeps the navigation that
         * lets you leave it, and ABOVE the three pages, so one boundary covers
         * them all. @layout/RouteErrorBoundary says what it does with the error.
         */
        errorElement: <RouteErrorBoundary />,
        /*
         * What the <Outlet> shows on the first render, while the router is
         * still fetching the page the URL asks for from its remote. On THIS
         * route rather than the layout above it, so the navigation is on
         * screen from the first frame and only the page's slot waits. Without
         * one the router renders nothing at all until the import lands.
         */
        HydrateFallback: PageLoading,
        children: [
          /**
           * "/" is a page now, not a forward. It used to redirect to "/account"
           * because there was nothing to land on; the welcome is that something,
           * and the nav in RootLayout is how you leave it.
           */
          { index: true, lazy: { Component: () => import("home/pages").then((m) => m.HomePage) } },
          {
            path: "account",
            lazy: { Component: () => import("account/pages").then((m) => m.AccountPage) },
          },
          {
            path: "account/edit",
            lazy: { Component: () => import("account/pages").then((m) => m.EditAccountPage) },
          },
        ],
      },
    ],
  },
];

/**
 * `createRoutes` is exported above so the integration tests can build their
 * own router over the same tree with a memory history - the pages navigate, so
 * testing one means giving it somewhere to navigate TO. A fresh router per
 * test, like the fresh QueryClient, so no test inherits another's history.
 *
 * A factory rather than a shared array, since the routes went `lazy`: the
 * router clears each `lazy` loader on the route object once it has run it, so
 * it is never run twice - and a SECOND router built over the same objects
 * finds `lazy: { Component: undefined }` and, measured, answers `No route
 * matches URL "/"` to every navigation. Static routes could be shared; lazy
 * ones belong to the router that resolved them, so each router gets its own.
 *
 * `wrapCreateBrowserRouter` is what tells Sentry the route tree: without it a
 * navigation span is named by the URL that was visited, with it by the ROUTE
 * that matched (`/account/edit`). With a parameterised route that is the
 * difference between one span you can compare over time and one per id; this
 * app has no params yet, and naming them by route now is what keeps the first
 * one from splitting the data.
 *
 * `instrumentations` is the router's own observability hook, and what it is
 * for here is the START of that span: the wrapper above learns of a navigation
 * from the URL change, which a data router makes only after the page's remote
 * has loaded, and the hook is what sees the click. ../sentry.ts says the rest.
 * The tests' memory router does without it - Sentry is off there.
 */
export const router = wrapCreateBrowserRouter(createBrowserRouter)(createRoutes(), {
  instrumentations: [routerInstrumentation],
});
