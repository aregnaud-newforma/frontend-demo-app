// Default (happy-path) request handlers shared by every test.
// Individual tests override these with worker.use(...) to simulate errors.
import { http, HttpResponse } from "msw";
import { accounts } from "./db";
import type { AccountPayload } from "../api";

// Any origin, this path. The origin is not knowable here and is different in
// each tier: Browser Mode serves the tests from an ephemeral port, and the
// mobile app talks to whatever EXPO_PUBLIC_API_URL names. A bare "/api/account"
// used to do the job, because MSW resolves a relative path against the PAGE -
// but jest runs the mobile tests in Node, where there is no page, and every
// request went through unmatched with `intercepted a request without a matching
// request handler`. The leading `*` is MSW's own wildcard for "whatever comes
// before", which is what makes one handler serve three runtimes.
export const ACCOUNT_URL = "*/api/account";

// Single-user example: "the account" is simply the only record in the store, so
// a test seeds one with seedAccount() and both handlers operate on it.
export const handlers = [
  http.get(ACCOUNT_URL, () => {
    const account = accounts.findFirst();
    if (!account) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(account);
  }),

  http.put(ACCOUNT_URL, async ({ request }) => {
    const body = (await request.json()) as AccountPayload;
    const account = accounts.findFirst();
    if (!account) return new HttpResponse(null, { status: 404 });

    // @msw/data v1: update() takes the record (or a query) and a `data`
    // producer that mutates a draft; it resolves to the updated record.
    const updated = await accounts.update(account, {
      strict: true,
      data(draft) {
        draft.nom = body.nom;
        draft.prenom = body.prenom;
        draft.email = body.email;
        draft.telephone = body.telephone;
        draft.langue = body.langue;
        draft.bio = body.bio;
      },
    });

    return HttpResponse.json(updated);
  }),
];
