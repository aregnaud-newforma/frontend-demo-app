import type { ActivityKind } from "./kinds";

/** One thing that happened on the account, as the server stores and returns it. */
export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  /** ISO 8601 in UTC. The server owns the clock; nothing here invents a date. */
  at: string;
  /** What happened, in the visitor's words rather than an event name. */
  summary: string;
  /** Where from, or null when the request carried nothing to say so. */
  device: string | null;
  /** The visitor's own note on this entry. Empty until they write one. */
  note: string;
}

/** What a note edit puts back over the wire. The server owns everything else. */
export interface NotePayload {
  note: string;
}

/**
 * What the visitor is asking the list for. Both halves are the server's job
 * rather than the page's: the log is the one thing here that can outgrow a
 * response, and a client that filters what it was already sent has to be given
 * everything first.
 */
export interface ActivityQuery {
  /** Free text, matched against the summary and the device. Empty means all. */
  readonly search: string;
  /** The kinds to include. Empty means all of them, not none. */
  readonly kinds: ReadonlySet<ActivityKind>;
}

/**
 * Single network boundary for this vertical, built the way `@account/helpers/api`
 * builds its own: from `window.location.origin`, so one module works in the app,
 * under Playwright, and under Vitest Browser Mode without knowing which it is.
 */
function activityUrl(query?: ActivityQuery) {
  const url = new URL("/api/account/activity", window.location.origin);
  if (query === undefined) return url;

  // Omitted rather than sent empty. A `?search=` that means "everything" reads
  // as a filter the server has to special-case, and it would land in the query
  // key below as a different cache entry for the same question.
  if (query.search.trim() !== "") url.searchParams.set("search", query.search.trim());
  // Sorted, so two Sets holding the same kinds in a different insertion order
  // produce one URL and one cache entry.
  if (query.kinds.size > 0) url.searchParams.set("kinds", [...query.kinds].toSorted().join(","));

  return url;
}

export async function getActivity(query: ActivityQuery): Promise<ActivityEntry[]> {
  const response = await fetch(activityUrl(query));

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as ActivityEntry[];
}

export async function updateNote(entryId: string, note: string): Promise<ActivityEntry> {
  const url = new URL(`/api/account/activity/${entryId}/note`, window.location.origin);
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note } satisfies NotePayload),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as ActivityEntry;
}
