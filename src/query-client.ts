import { QueryClient } from "@tanstack/react-query";

/**
 * The client every vertical's queries run on - the app owns the CACHE, while
 * each vertical owns what goes in it. The account's key lives with the fetch
 * that fills it, in account/hooks/use-account.ts, and nothing here knows it exists.
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
