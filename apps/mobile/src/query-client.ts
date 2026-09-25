import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import * as Sentry from "@sentry/react-native";

/**
 * The client every screen's queries run on - the twin of the web's
 * apps/shell/src/query-client.ts, and deliberately the same decisions:
 *
 * - a FACTORY, so the app builds one for its lifetime and each test builds its
 *   own; a client shared between tests carries one test's account into the next,
 *   which is how a react-query suite starts passing by file order.
 * - `retry: false`, because silently retrying a failed load three times with
 *   backoff only delays telling the user something is wrong.
 * - the reporting on the CACHES rather than on each `useQuery`, so a screen that
 *   adds a query is reported without having to know this file exists.
 *
 * Not imported from the shell, although the body is nearly identical: the shell
 * is a browser app that pulls in `@sentry/react` and everything under it. The
 * SDK is the difference - `@sentry/react-native` here - and it is the whole
 * reason a shared file would not have worked.
 *
 * `refetchOnWindowFocus` has no twin. React Native has no window to focus; the
 * equivalent is react-query's AppState integration, which is off by default and
 * stays off for the same reason it is off on the web.
 */
export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) =>
        Sentry.captureException(error, { tags: { queryKey: JSON.stringify(query.queryKey) } }),
    }),
    mutationCache: new MutationCache({
      onError: (error) => Sentry.captureException(error),
    }),
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}
