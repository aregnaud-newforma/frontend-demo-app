/**
 * What narrowing the activity log MEANS, in the one place both sides agree on
 * it: `server/api.ts` filters real requests with these, and
 * `../mocks/handlers.ts` filters the mock store with the same two functions. A
 * handler that matched more loosely than the server would let a test pass on
 * behaviour the product does not have.
 *
 * Its own module, apart from `./activity.ts`, because of who imports it. The API
 * process runs under Node's type stripping with no bundler, so every runtime
 * import it reaches has to be resolvable by Node — which means extensions, all
 * the way down. Type-only imports are erased before that matters, so a module
 * with nothing but type imports can be shared with the server as it stands.
 * `./activity.ts` cannot: it needs `ACTIVITY_KINDS` at runtime.
 */
import type { ActivityKind } from "./kinds";
import type { ActivityEntry } from "./api";

/**
 * Whether an entry answers a free-text search. Matches the summary and the
 * device, which are the two things a visitor can actually read on a row.
 */
export const matchesSearch = (entry: ActivityEntry, search: string): boolean => {
  const needle = search.trim().toLowerCase();
  if (needle === "") return true;

  return (
    entry.summary.toLowerCase().includes(needle) ||
    (entry.device?.toLowerCase().includes(needle) ?? false)
  );
};

/**
 * Whether an entry survives a kind filter.
 *
 * An empty set means every kind, not none: nothing ticked is the page's initial
 * state, and reading it as "show nothing" would greet every visitor with an
 * empty log.
 */
export const matchesKinds = (entry: ActivityEntry, kinds: ReadonlySet<ActivityKind>): boolean =>
  kinds.size === 0 || kinds.has(entry.kind);
