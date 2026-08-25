import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "../query-client";

/**
 * The composition root the tests mount through - every context a page or a
 * component needs to work, and nothing else.
 *
 * It mirrors ../main.tsx rather than being imported from it: the entry builds
 * its providers inline around <App />, so there is nothing to import. The one
 * thing to keep in step is the LIST - a provider added to main.tsx and not here
 * lands as a crash, or a blank render, in whichever test first mounts the
 * component that consumes it.
 *
 * The router is deliberately NOT here. A page reaches it through
 * ./render-route, and a component tested on its own never sees a route - a
 * router around it would only add a screen it does not render.
 *
 * The QueryClient is built once per MOUNT, through useState rather than a bare
 * call, so a re-render inside a test keeps the cache it started with while the
 * next test still gets a fresh one. A client shared across tests carries one
 * test's account into the next, which is how a react-query suite starts passing
 * according to file order.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
