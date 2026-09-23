import { createBrowserRouter, type RouteObject } from "react-router";
import { AccountPage } from "@account/AccountPage";
import { EditAccountPage } from "@account/EditAccountPage";
import { HomePage } from "@home/HomePage";
import { RootLayout } from "@layout/RootLayout";

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
 */
export const routes: RouteObject[] = [
  {
    // Pathless, so the shell wraps every route without owning a URL segment.
    Component: RootLayout,
    children: [
      /**
       * "/" is a page now, not a forward. It used to redirect to "/account"
       * because there was nothing to land on; the welcome is that something,
       * and the nav in RootLayout is how you leave it.
       */
      { index: true, Component: HomePage },
      { path: "account", Component: AccountPage },
      { path: "account/edit", Component: EditAccountPage },
    ],
  },
];

/**
 * `routes` is exported above so the integration tests can build their own
 * router over the same tree with a memory history - the pages navigate, so
 * testing one means giving it somewhere to navigate TO. A fresh router per
 * test, like the fresh QueryClient, so no test inherits another's history.
 */
export const router = createBrowserRouter(routes);
