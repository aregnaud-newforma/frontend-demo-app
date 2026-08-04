import { render } from "vitest-browser-react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { createQueryClient } from "../query-client";
import { routeTree } from "../routes";

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
 * Both the router and the QueryClient are built fresh per call. A shared router
 * would carry one test's history into the next, and a shared cache would carry
 * one test's account - the two ways a browser suite starts passing, or failing,
 * according to file order.
 *
 * This is the only setup shared between the page test files. The LOCATORS stay
 * in each file, where the test can see what it is driving.
 */
export async function renderRoute(initialPath: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });

  return await render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
