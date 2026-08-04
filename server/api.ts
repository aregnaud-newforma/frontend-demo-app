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
 * Run it with `yarn api:start`. Playwright starts it itself (see the webServer
 * array in playwright.config.ts), so no one has to remember to.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Account, AccountPayload } from "../src/account/helpers/api.ts";

const PORT = Number(process.env.PORT ?? 3001);

/** The cookie the browser carries, and the header the seeding call sends. */
export const SESSION_COOKIE = "e2e-session";
export const SESSION_HEADER = "x-e2e-session";

/** session id -> that session's single account. */
const accountsBySession = new Map<string, Account>();

function readSession(request: IncomingMessage): string | null {
  const fromHeader = request.headers[SESSION_HEADER];
  if (typeof fromHeader === "string" && fromHeader) return fromHeader;

  const cookies = request.headers.cookie ?? "";
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
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
  if (!session) {
    // Loud on purpose. A request with no session means a spec navigated before
    // starting one, and answering 404 would send it looking for the bug in the
    // app instead of in its own setup.
    sendJson(response, 400, {
      error: `Missing session. Send the ${SESSION_HEADER} header or the ${SESSION_COOKIE} cookie.`,
    });
    return;
  }

  // Test-only: put an account in this session's store. Namespaced away from
  // /api/ so it is obvious at the call site that it is not part of the product
  // surface the specs are exercising.
  if (url.pathname === "/__test__/account" && method === "PUT") {
    const account = await readJsonBody<Account>(request);
    accountsBySession.set(session, account);
    sendJson(response, 201, account);
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
