/**
 * The account API, for real. A small HTTP server over Postgres so the E2E tier
 * has an actual backend to talk to instead of an interceptor standing in for
 * one, and so `yarn dev` shows data that outlives a restart.
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
 * WHAT IT IS MADE OF: this file is the HTTP surface only. The tables are in
 * schema.ts, the queries in store.ts, the connection and startup migration in
 * db.ts - see docs/adr/0001-postgres-and-drizzle-behind-the-api.md for why a
 * demo carries a database at all.
 *
 * PER-TEST ISOLATION: Playwright runs specs in parallel (`fullyParallel`), and
 * one shared backend would mean one spec's PUT changing what another spec's GET
 * returns. So every row is keyed by a session id, which each test generates and
 * puts in a cookie on its own browser context (see e2e/session.ts). The browser
 * sends it with every request; the server reads it and sees only that test's
 * data. This is the part a mocked backend never has to solve, and the part real
 * E2E against a shared environment always does.
 *
 * A request that names no session gets DEMO_SESSION, which is seeded on first
 * start - that is what makes `yarn dev` show an account rather than an error,
 * since nothing outside the specs ever sets the cookie.
 *
 * Run it with `yarn api:start`, with the database from `yarn db:start` up.
 * Playwright starts the API itself (see the webServer array in
 * playwright.config.ts), so no one has to remember to.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Account, AccountPayload } from "../src/account/helpers/api.ts";
import { connect } from "./db.ts";
import { findAccount, saveAccount, updateAccount } from "./store.ts";

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
 * Seeded once, the first time the API starts against an empty database, and
 * mutable like any other session: the form saves, the summary comes back
 * changed, and the change is still there after a restart.
 *
 * A spec that forgets `startSession` lands here rather than on an error - but
 * it still fails, and at the right place: its assertions name the random values
 * it seeded, and this record matches none of them.
 */
const DEMO_SESSION = "demo";

const DEMO_ACCOUNT: Account = {
  id: "demo-account",
  nom: "Durand",
  prenom: "Camille",
  email: "camille.durand@example.com",
  telephone: "+33612345678", // stored in E.164, shown as 0612345678
  langue: "fr",
  bio: "Designs things, occasionally writes about them.",
};

const db = await connect();

if (!(await findAccount(db, DEMO_SESSION))) {
  await saveAccount(db, DEMO_SESSION, DEMO_ACCOUNT);
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

  // Playwright's webServer polls this to know the process is up. Listening
  // already means the database answered and the migrations ran (see db.ts).
  if (url.pathname === "/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  const session = readSession(request);

  // Test-only: put an account in this session's store. Namespaced away from
  // /api/ so it is obvious at the call site that it is not part of the product
  // surface the specs are exercising.
  if (url.pathname === "/__test__/account" && method === "PUT") {
    const account = await readJsonBody<Account>(request);
    sendJson(response, 201, await saveAccount(db, session, account));
    return;
  }

  if (url.pathname === "/api/account") {
    if (method === "GET") {
      const stored = await findAccount(db, session);
      if (!stored) {
        sendJson(response, 404, { error: "No account for this session" });
        return;
      }
      sendJson(response, 200, stored);
      return;
    }

    if (method === "PUT") {
      const payload = await readJsonBody<AccountPayload>(request);
      const updated = await updateAccount(db, session, payload);
      if (!updated) {
        sendJson(response, 404, { error: "No account for this session" });
        return;
      }
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
