import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { datadogRum } from "@datadog/browser-rum";
import * as Sentry from "@sentry/react";

/**
 * The client every vertical's queries run on - the app owns the CACHE, while
 * each vertical owns what goes in it. The account's key lives with the fetch
 * that fills it, in packages/account-core/src/use-account.ts, and nothing here
 * knows it exists.
 *
 * A factory, not a singleton module export, on purpose: the app builds one
 * client for its lifetime, and each TEST builds its own. Sharing a client
 * between tests would carry a previous test's cached account into the next one,
 * which is the classic way a react-query suite starts passing for the wrong
 * reason (or failing depending on file order).
 *
 * `retry: false` is an app choice, not a test hack - and the tests use the very
 * same factory, so what they exercise is what ships. Silently retrying a failed
 * account load three times with backoff would only delay telling the user
 * something is wrong; the form surfaces the failure and offers to try again.
 */
export function createQueryClient() {
  return new QueryClient({
    /*
     * Where a failed request becomes a Sentry issue - and the reason nothing
     * else in the app reports one.
     *
     * react-query CATCHES what a `queryFn` or a `mutationFn` throws and hands
     * it back as `isError`, which is exactly what the pages want: the account
     * form shows a banner and offers to try again. The cost is that the SDK's
     * global handlers never see it. `window.onerror` fires on an UNHANDLED
     * error, and this one is handled - by the UI, on purpose. So a 500 on
     * /api/account used to be a visible failure that reached Sentry never.
     *
     * On the caches rather than on each `useQuery`/`useMutation`, so a vertical
     * that adds a query is reported without having to know this file exists.
     *
     * EVERY failure, expected ones included: a session with no account answers
     * 404, and that lands here too. Fine for a demo, and named rather than
     * hidden - a real app filters on the status here before capturing.
     *
     * Datadog is told the same, for the same reason: its global handler is
     * bypassed exactly as Sentry's is.
     */
    queryCache: new QueryCache({
      onError: (error, query) => {
        // The key as a tag, because one thrown `Error: Request failed with
        // status 500` looks like any other in the issue list; the key is what
        // says WHICH fetch it was.
        const queryKey = JSON.stringify(query.queryKey);
        Sentry.captureException(error, { tags: { queryKey } });
        datadogRum.addError(error, { queryKey });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        Sentry.captureException(error);
        datadogRum.addError(error);
      },
    }),
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
