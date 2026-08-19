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
// FIRST, deliberately. Modules are evaluated in the order they are imported,
// and this one starts the OpenTelemetry SDK - anything traced has to be loaded
// after it. See server/instrumentation.ts.
import { langfuseSpanProcessor } from "./instrumentation.ts";

import { propagateAttributes, startActiveObservation, startObservation } from "@langfuse/tracing";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Account, AccountPayload } from "../src/account/helpers/api.ts";

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

/**
 * What a route decided. Routing returns one of these rather than writing to the
 * socket itself, so that the status and the body exist as a value: `handle`
 * sends it, and the trace around it can record what was answered without every
 * branch having to remember to say so.
 */
interface ApiResult {
  status: number;
  body: unknown;
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const method = request.method ?? "GET";

  // Playwright's webServer polls this to know the process is up. Left untraced:
  // it fires every few hundred milliseconds and says nothing about the app, and
  // a trace list drowned in health checks is a trace list no one reads.
  if (url.pathname === "/health") {
    sendJson(response, 200, { ok: true, sessions: accountsBySession.size });
    return;
  }

  const session = readSession(request);
  const result = await traced(method, url.pathname, session, () =>
    route(method, url.pathname, session, request),
  );

  sendJson(response, result.status, result.body);
}

async function route(
  method: string,
  pathname: string,
  session: string,
  request: IncomingMessage,
): Promise<ApiResult> {
  // Test-only: put an account in this session's store. Namespaced away from
  // /api/ so it is obvious at the call site that it is not part of the product
  // surface the specs are exercising.
  if (pathname === "/__test__/account" && method === "PUT") {
    const account = await readJsonBody<Account>(request);
    accountsBySession.set(session, account);
    return { status: 201, body: account };
  }

  if (pathname === "/api/account") {
    const stored = accountsBySession.get(session);

    if (method === "GET") {
      if (!stored) return { status: 404, body: { error: "No account for this session" } };
      return { status: 200, body: stored };
    }

    if (method === "PUT") {
      if (!stored) return { status: 404, body: { error: "No account for this session" } };

      // The server owns the id: it is not in the payload and must not be
      // overwritten by one. Everything else the client sent replaces what
      // is stored, which is what makes the GET after a PUT meaningful.
      const payload = await readJsonBody<AccountPayload>(request);

      // Nested under the request's own observation, so a trace shows the write
      // as its own step: which fields the payload carried, and how long the
      // parse before it took. Field NAMES only - the values are a person.
      const persist = startObservation("persist-account", {
        input: { fields: Object.keys(payload) },
      });

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
      persist.update({ output: { accountId: updated.id } }).end();

      return { status: 200, body: updated };
    }

    return { status: 405, body: { error: `${method} not allowed on ${pathname}` } };
  }

  return { status: 404, body: { error: `No route for ${method} ${pathname}` } };
}

/**
 * The name one request's trace carries in Langfuse.
 *
 * Names are an API there: evaluators, dashboard filters and saved views all
 * target them, so they have to be stable and few. That is why this maps to a
 * fixed set of verbs rather than interpolating the path - `get-account`, not
 * `GET /api/account`, and never anything carrying a session or an id.
 */
function operationName(method: string, pathname: string): string {
  if (pathname === "/api/account") {
    if (method === "GET") return "get-account";
    if (method === "PUT") return "update-account";
    return "reject-account-method";
  }
  if (pathname === "/__test__/account" && method === "PUT") return "seed-account";
  return "reject-unknown-route";
}

/**
 * What the trace records as the answer. The account itself is NOT it: this
 * server stores a person, and a trace is a copy of whatever you put in it, kept
 * somewhere else. The status, the id, and which fields came back say what
 * happened; the values would only say who it happened to.
 */
function traceOutput({ status, body }: ApiResult): Record<string, unknown> {
  if (body && typeof body === "object" && "id" in body) {
    return { status, accountId: (body as Account).id, fields: Object.keys(body) };
  }
  return { status, ...(body as Record<string, unknown>) };
}

/**
 * One trace per request.
 *
 * A request here is exactly the self-contained unit of work Langfuse means by a
 * trace: it arrives, it reads or writes one session's account, it answers.
 * `sessionId` is the same id the specs put in the cookie (see the note on
 * per-test isolation above), so the Sessions view groups a whole spec's round
 * trips the way the store already groups its data - which is what turns "the
 * third PUT returned 404" into something readable.
 *
 * With no Langfuse keys configured this is a pass-through, so the E2E tier
 * never depends on an account existing.
 */
function traced(
  method: string,
  pathname: string,
  session: string,
  run: () => Promise<ApiResult>,
): Promise<ApiResult> {
  if (!langfuseSpanProcessor) return run();

  return startActiveObservation(operationName(method, pathname), (span) =>
    propagateAttributes(
      {
        sessionId: session,
        // The account id doubles as the user id: one session holds one account.
        userId: accountsBySession.get(session)?.id,
        tags: ["account-api"],
      },
      async () => {
        span.update({ input: { method, path: pathname } });
        const result = await run();
        span.update({
          output: traceOutput(result),
          // So "show me what failed" is a filter rather than a read-through of
          // every trace. A 4xx is the client being told no, which is worth
          // seeing but not an incident; a 5xx is this server breaking.
          ...(result.status >= 400 && {
            level: result.status >= 500 ? ("ERROR" as const) : ("WARNING" as const),
            statusMessage: `${result.status} on ${operationName(method, pathname)}`,
          }),
        });
        return result;
      },
    ),
  );
}

server.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
});

// Spans are batched in memory and sent on a timer, and nobody asks this process
// to stop politely - Playwright kills it when the run ends, Ctrl-C kills it in
// development. Without this, the last few seconds of a run are the ones you
// wanted to look at and the ones that never left the process.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void (async () => {
      await langfuseSpanProcessor?.forceFlush();
      server.close(() => process.exit(0));
    })();
  });
}
