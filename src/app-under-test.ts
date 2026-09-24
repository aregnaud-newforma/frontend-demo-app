import type { AppUnderTest } from "@testing/app-under-test";
import { createRoutes } from "./routes";
import { createQueryClient } from "./query-client";

/**
 * This app, as the integration tests mount it.
 *
 * The harness in src/testing/ takes the route tree and the QueryClient factory
 * as an argument so that it depends on nothing of this app's - @testing/
 * app-under-test says why - and this file is the other end of that: the ONE
 * place the two are named together, so a test file passes `app` and does not
 * assemble anything itself.
 *
 * It lives beside main.tsx rather than in testing/, because it is the shell
 * that owns the route tree and the providers. A vertical's test importing it
 * is the dependency that was always there - a page test mounts the whole
 * tree - and is now written down.
 */
export const app: AppUnderTest = { createRoutes, createQueryClient };
