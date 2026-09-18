import { ACTIVITY_KINDS, type ActivityKind } from "./kinds";
import type { ActivityEntry } from "./api";

/**
 * The log newest first, as a new array.
 *
 * `toSorted` rather than `sort`: the argument here is whatever the query cache
 * is holding, and sorting it in place would reorder the cached value under
 * every other reader of that same query — a mutation React has no way to see
 * and no way to re-render for.
 */
export const newestFirst = (entries: readonly ActivityEntry[]): ActivityEntry[] =>
  entries.toSorted((left, right) => right.at.localeCompare(left.at));

/**
 * A kind switched on or off, as a new Set.
 *
 * `Set.prototype.union` and `difference` would each say this in one word, and
 * they are deliberately out of reach: tsconfig pins `lib` to ES2023 because the
 * set methods are Safari 17 and this app's floor is Safari 16.4. Nothing in the
 * build polyfills them, so they would work in `vite dev` and throw for a real
 * visitor. `delete` returning whether it removed anything is the toggle without
 * the second lookup — raise the floor in package.json and vite.config.ts first
 * if the one-word version is ever worth it.
 */
export const toggleKind = (
  selected: ReadonlySet<ActivityKind>,
  kind: ActivityKind,
): Set<ActivityKind> => {
  const next = new Set(selected);
  if (!next.delete(kind)) next.add(kind);
  return next;
};

/**
 * The selection narrowed to the kinds that exist, for a Set that came off a URL
 * or a stored preference. Driven from `ACTIVITY_KINDS` rather than from the
 * selection, so the result is in the declared order whatever order it arrived
 * in — and, like the toggle above, without `Set.prototype.intersection`.
 */
export const knownKinds = (selected: ReadonlySet<ActivityKind>): Set<ActivityKind> =>
  new Set(ACTIVITY_KINDS.filter((kind) => selected.has(kind)));

/**
 * How many entries each kind accounts for, over the whole list.
 *
 * Every kind is present even at zero: the filter renders one control per kind
 * whatever the data holds, and a missing key would make the count fall back to
 * something the caller had to invent.
 */
export const countByKind = (entries: readonly ActivityEntry[]): Record<ActivityKind, number> => {
  const counts = Object.fromEntries(ACTIVITY_KINDS.map((kind) => [kind, 0])) as Record<
    ActivityKind,
    number
  >;

  for (const entry of entries) counts[entry.kind] += 1;

  return counts;
};

/**
 * The date a visitor reads, from the ISO string the server sent.
 *
 * `undefined` as the locale, not a hard-coded one: that is the browser's, which
 * is the only locale this app has any claim to know. The account's own `langue`
 * is what it writes IN, not where its reader lives.
 */
export const formatWhen = (at: string): string =>
  new Date(at).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
