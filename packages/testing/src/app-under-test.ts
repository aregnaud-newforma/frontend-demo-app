import type { RouteObject } from "react-router";
import type { QueryClient } from "@tanstack/react-query";

/**
 * What the harness needs from the app it is mounting, and the reason this
 * folder imports nothing from the app itself.
 *
 * The harness used to reach for ../routes and ../query-client directly, which
 * read fine while everything was one folder and stops reading at all once the
 * verticals are packages: the shell would own the harness, every vertical's
 * tests would depend on the shell, and the shell's own layout tests would
 * depend back on the harness. Taking the two factories as an argument makes
 * this folder a LEAF - it depends on react-router and react-query, on nothing
 * of this app's - and moves the edge to where it was always true: a vertical's
 * integration test mounts the SHELL's route tree, and now says so.
 */
export type AppUnderTest = {
  /**
   * A factory rather than a tree, for the reason ../routes.tsx gives: a data
   * router writes into the route objects it is handed, so a second router
   * built over the same ones finds every `lazy` loader already cleared.
   */
  createRoutes: () => RouteObject[];
  /** Fresh per mount, so no test inherits another's cache. */
  createQueryClient: () => QueryClient;
};
