import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getActivity, updateNote, type ActivityQuery } from "../helpers/api";

/**
 * The cache key for one question. A Set has no stable serialization, so the
 * kinds go in as a sorted array — the same normalization `activityUrl` does, and
 * for the same reason: two Sets built in a different order are one question.
 */
export const activityQueryKey = (query: ActivityQuery) =>
  ["activity", { search: query.search.trim(), kinds: [...query.kinds].toSorted() }] as const;

/**
 * The activity log for what the visitor is currently asking for.
 *
 * The search term is part of the KEY, not something an effect re-fetches on.
 * That is what makes a fast typist safe: every keystroke is its own query, the
 * cache resolves which one is current, and a reply that arrives late belongs to
 * a key nobody is rendering rather than overwriting the list with stale rows.
 *
 * `keepPreviousData` is what makes it bearable to watch. Without it each new
 * term drops the list back to its loading state and the page flickers on every
 * letter; with it the previous answer stays on screen, marked stale through
 * `isPlaceholderData`, until the new one lands.
 */
export function useActivity(query: ActivityQuery) {
  return useQuery({
    queryKey: activityQueryKey(query),
    queryFn: () => getActivity(query),
    placeholderData: keepPreviousData,
  });
}

/**
 * Saving one entry's note.
 *
 * Invalidates by prefix rather than writing the response into a key: the same
 * entry is in every cached search and kind combination the visitor has already
 * been through, and this mutation knows none of them. `["activity"]` matches
 * them all, and react-query refetches only the ones still mounted.
 */
export function useSaveNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ entryId, note }: { entryId: string; note: string }) => updateNote(entryId, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["activity"] }),
  });
}
