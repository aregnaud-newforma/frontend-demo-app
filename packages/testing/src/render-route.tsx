import { render } from "vitest-browser-react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { AppProviders } from "./app-providers";
import type { AppUnderTest } from "./app-under-test";

/**
 * Mounts the app at one route, the way a visitor arrives at it.
 *
 * The pages navigate now, so a page cannot be tested in isolation from the tree
 * it navigates within: rendering EditAccountPage alone would mean a save that
 * goes nowhere, which is not the behaviour anyone ships. Mounting the real route
 * tree over a MEMORY history gives the navigation somewhere to land without a
 * URL bar - and it means the tests exercise the same route definitions the app
 * does, so a path renamed in one place fails here rather than in production.
 *
 * The route tree arrives as an argument rather than as an import, which is what
 * keeps this folder a leaf - ./app-under-test says why - and what makes a
 * vertical's test state the thing that was always true: it mounts the SHELL's
 * routes.
 *
 * The router is built fresh per call, over a fresh route tree, and
 * ./app-providers builds a fresh QueryClient per mount. A shared router would
 * carry one test's history into the next, and a shared cache would carry one
 * test's account - the two ways a browser suite starts passing, or failing,
 * according to file order. The tree has to be fresh too, and the shell's
 * routes.tsx says why: a data router writes into the route objects it is
 * given.
 *
 * Everything below the router comes from AppProviders, the same composition
 * root ./render-component mounts a lone component under, so a page and a
 * component see the same contexts.
 *
 * This is the only setup shared between the page test files. The LOCATORS stay
 * in each file, where the test can see what it is driving.
 */
export async function renderRoute(initialPath: string, app: AppUnderTest) {
  const router = createMemoryRouter(app.createRoutes(), { initialEntries: [initialPath] });

  return await render(
    <AppProviders app={app}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}
