// Default (happy-path) handlers for the activity log. A test that needs a
// refusal overrides these with worker.use(...) in the journey that needs it.
import { http, HttpResponse } from "msw";
import { matchesKinds, matchesSearch } from "../helpers/filtering";
import { isActivityKind, type ActivityKind } from "../helpers/kinds";
import { activity } from "./db";
import type { ActivityEntry, NotePayload } from "../helpers/api";

// Relative, like ACCOUNT_URL: Browser Mode serves the tests from an ephemeral
// port, so MSW resolves these against the page origin — the same origin the app
// builds its request from.
export const ACTIVITY_URL = "/api/account/activity";
export const NOTE_URL = "/api/account/activity/:entryId/note";

/**
 * The filtering the real server does, over the mock store.
 *
 * Reusing `matchesSearch` and `matchesKinds` rather than writing the comparison
 * again: a handler that matched more loosely than the server would let a test
 * pass on behaviour the product does not have, which is the one thing a mock at
 * the boundary must not do.
 */
export const handlers = [
  http.get(ACTIVITY_URL, ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search") ?? "";
    const kinds = new Set<ActivityKind>(
      (url.searchParams.get("kinds") ?? "").split(",").filter((value) => isActivityKind(value)),
    );

    const matching = activity
      .findMany()
      .filter((entry) => matchesSearch(entry, search) && matchesKinds(entry, kinds));

    return HttpResponse.json(matching);
  }),

  http.put(NOTE_URL, async ({ params, request }) => {
    const entry = activity.findFirst((query) => query.where({ id: String(params.entryId) }));
    if (!entry) return new HttpResponse(null, { status: 404 });

    const body = (await request.json()) as NotePayload;
    const updated = await activity.update(entry, {
      strict: true,
      data(draft) {
        draft.note = body.note;
      },
    });

    return HttpResponse.json(updated satisfies ActivityEntry);
  }),
];
