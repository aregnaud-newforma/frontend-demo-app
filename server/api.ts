/**
 * The account API, for real. A tiny in-memory HTTP server so the E2E tier has
 * an actual backend to talk to instead of an interceptor standing in for one.
 *
 * WHY IT EXISTS: every other tier mocks the network on purpose - the unit tests
 * never touch it, the integration tests put MSW at the boundary so a component
 * can be driven through states a real server would make slow or impossible to
 * reach. E2E is the one tier whose whole job is to prove the pieces agree when
 * nothing is standing in for anything, and a stubbed backend quietly takes that
 * away: `route.fulfill()` cannot disagree with the frontend about a status code,
 * a header, or how a JSON body is shaped, because it IS the frontend's own
 * assumptions being played back at it.
 *
 * WHY IT IS THIS SMALL: it is not a product server. It stores accounts in a Map
 * and forgets them when the process dies. What matters is that it is a separate
 * process, reached over real HTTP, that the frontend cannot reach into - so
 * every claim the E2E specs make about the round trip is a claim about two
 * programs agreeing.
 *
 * PER-TEST ISOLATION: Playwright runs specs in parallel (`fullyParallel`), and
 * one shared backend would mean one spec's PUT changing what another spec's GET
 * returns. So the store is keyed by a session id, which each test generates and
 * puts in a cookie on its own browser context (see e2e/session.ts). The browser
 * sends it with every request; the server reads it and sees only that test's
 * data. This is the part a mocked backend never has to solve, and the part real
 * E2E against a shared environment always does.
 *
 * A request that names no session gets DEMO_SESSION, which is seeded at startup
 * - that is what makes `yarn dev` show an account rather than an error, since
 * nothing outside the specs ever sets the cookie.
 *
 * Run it with `yarn api:start`. Playwright starts it itself (see the webServer
 * array in playwright.config.ts), so no one has to remember to.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Account, AccountPayload } from "../src/account/helpers/api.ts";
import type { ActivityEntry, NotePayload } from "../src/activity/helpers/api.ts";
import { matchesKinds, matchesSearch } from "../src/activity/helpers/filtering.ts";
import { isActivityKind, type ActivityKind } from "../src/activity/helpers/kinds.ts";

const PORT = Number(process.env.PORT ?? 3001);

/** The cookie the browser carries, and the header the seeding call sends. */
export const SESSION_COOKIE = "e2e-session";
export const SESSION_HEADER = "x-e2e-session";

/**
 * The session a request belongs to when it names none - which is every request
 * from a browser someone opened themselves, since only the specs set the
 * cookie. Without it `yarn dev` has no way to reach any data at all: the store
 * starts empty and `/__test__/account` is the only thing that fills it.
 *
 * Seeded at startup (below) so the app has something to show, and mutable like
 * any other session, so the form saves and the summary comes back changed.
 *
 * A spec that forgets `startSession` lands here rather than on an error - but
 * it still fails, and at the right place: its assertions name the random values
 * it seeded, and this record matches none of them.
 */
const DEMO_SESSION = "demo";

/** session id -> that session's single account. */
const accountsBySession = new Map<string, Account>();

accountsBySession.set(DEMO_SESSION, {
  id: "demo-account",
  nom: "Durand",
  prenom: "Camille",
  email: "camille.durand@example.com",
  telephone: "+33612345678", // stored in E.164, shown as 0612345678
  langue: "fr",
  bio: "Designs things, occasionally writes about them.",
});

/** session id -> that session's activity log, newest order not guaranteed. */
const activityBySession = new Map<string, ActivityEntry[]>();

activityBySession.set(DEMO_SESSION, [
  {
    id: "demo-1",
    kind: "sign-in",
    at: "2026-01-01T12:00:00.000Z",
    summary: "Signed in from a new device",
    device: "Chrome on macOS",
    note: "",
  },
  {
    id: "demo-2",
    kind: "profile-change",
    at: "2025-12-30T09:12:00.000Z",
    summary: "Changed your email address",
    device: "Safari on iPhone",
    note: "",
  },
  {
    id: "demo-3",
    kind: "security",
    at: "2025-12-24T18:45:00.000Z",
    summary: "Two-factor authentication enabled",
    device: null,
    note: "",
  },
]);

/**
 * The two stores, read the way a store is read: asynchronously.
 *
 * They are Maps today and a `Promise.resolve` away from being synchronous, and
 * that is exactly why they are written like this. The route below has to fetch
 * an account and a log to answer one request, and whether it does so in
 * sequence or side by side is a property of the route, not of how fast this
 * particular store happens to be. Written synchronously, the shape of the
 * handler would silently stop being the shape a real backend needs.
 */
async function readAccount(session: string): Promise<Account | undefined> {
  return accountsBySession.get(session);
}

async function readActivity(session: string): Promise<ActivityEntry[]> {
  return activityBySession.get(session) ?? [];
}

function readSession(request: IncomingMessage): string {
  const fromHeader = request.headers[SESSION_HEADER];
  if (typeof fromHeader === "string" && fromHeader) return fromHeader;

  const cookies = request.headers.cookie ?? "";
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : DEMO_SESSION;
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Array<Buffer> = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
    // The account is per-session and mutable; a cached GET would show the
    // pre-save value after a PUT and make the last assertion flake.
    "Cache-Control": "no-store",
  });
  response.end(payload);
}

const server = createServer((request, response) => {
  void handle(request, response).catch((error: unknown) => {
    sendJson(response, 500, { error: String(error) });
  });
});

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const method = request.method ?? "GET";

  // Playwright's webServer polls this to know the process is up.
  if (url.pathname === "/health") {
    sendJson(response, 200, { ok: true, sessions: accountsBySession.size });
    return;
  }

  const session = readSession(request);

  // Test-only: put an account in this session's store. Namespaced away from
  // /api/ so it is obvious at the call site that it is not part of the product
  // surface the specs are exercising.
  if (url.pathname === "/__test__/account" && method === "PUT") {
    const account = await readJsonBody<Account>(request);
    accountsBySession.set(session, account);
    sendJson(response, 201, account);
    return;
  }

  // Test-only, and separate from the account above: a spec that wants a log
  // says so, and one that does not gets an empty one rather than three rows it
  // never asked for.
  if (url.pathname === "/__test__/activity" && method === "PUT") {
    const entries = await readJsonBody<ActivityEntry[]>(request);
    activityBySession.set(session, entries);
    sendJson(response, 201, entries);
    return;
  }

  if (url.pathname === "/api/account/activity" && method === "GET") {
    // Both reads START together: neither needs the other's answer, so stacking
    // them would add a round trip to every request for nothing.
    //
    // Only the account is AWAITED before the decision, though. A `Promise.all`
    // over the pair would be parallel and still make a session with no account
    // wait for a log it is never going to send — the 404 discards it. Starting
    // both and awaiting each where its value is first needed is what gets the
    // parallelism without paying for the unused half.
    const accountRead = readAccount(session);
    const activityRead = readActivity(session);

    const account = await accountRead;
    if (!account) {
      // The log is already in flight and nothing below will await it. Left
      // alone, a rejection would surface as an unhandled one, outside the catch
      // wrapped around `handle`.
      void activityRead.catch(() => undefined);
      sendJson(response, 404, { error: "No account for this session" });
      return;
    }

    const entries = await activityRead;

    const search = url.searchParams.get("search") ?? "";
    // Unknown kinds are dropped rather than rejected: the parameter is a filter,
    // and a name this server does not have simply matches nothing. An empty set
    // means every kind, which is what "no filter" has to mean.
    const kinds = new Set<ActivityKind>(
      (url.searchParams.get("kinds") ?? "").split(",").filter((value) => isActivityKind(value)),
    );

    sendJson(
      response,
      200,
      entries.filter((entry) => matchesSearch(entry, search) && matchesKinds(entry, kinds)),
    );
    return;
  }

  const noteMatch = /^\/api\/account\/activity\/([^/]+)\/note$/.exec(url.pathname);
  if (noteMatch) {
    if (method !== "PUT") {
      sendJson(response, 405, { error: `${method} not allowed on ${url.pathname}` });
      return;
    }

    const entries = await readActivity(session);
    const entry = entries.find((candidate) => candidate.id === decodeURIComponent(noteMatch[1]));

    // The body is read only once there is something to write it to. Parsing it
    // first would mean draining a request stream for an entry this session does
    // not have, and the 404 is the same either way.
    if (!entry) {
      sendJson(response, 404, { error: "No such activity entry" });
      return;
    }

    const payload = await readJsonBody<NotePayload>(request);
    entry.note = payload.note;
    sendJson(response, 200, entry);
    return;
  }

  if (url.pathname === "/api/account") {
    const stored = accountsBySession.get(session);

    if (method === "GET") {
      if (!stored) {
        sendJson(response, 404, { error: "No account for this session" });
        return;
      }
      sendJson(response, 200, stored);
      return;
    }

    if (method === "PUT") {
      if (!stored) {
        sendJson(response, 404, { error: "No account for this session" });
        return;
      }

      // The server owns the id: it is not in the payload and must not be
      // overwritten by one. Everything else the client sent replaces what
      // is stored, which is what makes the GET after a PUT meaningful.
      const payload = await readJsonBody<AccountPayload>(request);
      const updated: Account = {
        id: stored.id,
        nom: payload.nom,
        prenom: payload.prenom,
        email: payload.email,
        telephone: payload.telephone,
        langue: payload.langue,
        bio: payload.bio,
      };

      accountsBySession.set(session, updated);
      sendJson(response, 200, updated);
      return;
    }

    sendJson(response, 405, { error: `${method} not allowed on ${url.pathname}` });
    return;
  }

  sendJson(response, 404, { error: `No route for ${method} ${url.pathname}` });
}

server.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
});
