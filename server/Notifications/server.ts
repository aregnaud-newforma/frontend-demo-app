// The notifications service. A second backend process, on its own port, that
// the account API calls when an account changes - and the reason this repo has
// a backend worth tracing across at all.
//
// WHY IT EXISTS: telling someone their account changed is not the account
// store's job, and in a system split by subject it is not its deployment
// either. That much is ordinary. What it is HERE for is the question it lets
// the demo answer: when the backend is more than one service, does Sentry still
// show one request as one thing? It does, and docs/adr/0004 is where the
// mechanism is written down.
//
// WHY IT IS NODE WHILE ../Accounts IS .NET: because two ASP.NET Core processes
// prove the easy half. A trace is linked by its id, not by its runtime, and the
// only way to show that rather than assert it is to make the two hops speak
// different languages. See docs/adr/0005.
//
// WHAT IT IS MADE OF: this file is the HTTP surface only. The message shapes
// and the rendering are in messages.ts, the store in outbox.ts, and the Sentry
// setup in instrument.ts - which is NOT imported here, because it has to be
// loaded before this file is (see the `--import` flag in the
// `notifications:start` script).
//
// WHAT IT DOES NOT HAVE: a database (outbox.ts says why), a queue, a framework
// (three fixed paths do not need routing), and any knowledge of what an account
// is beyond the three fields messages.ts declares.
//
// Run it with `yarn notifications:start`. `yarn start` runs it beside the
// account API and the frontend, and Playwright starts it itself (see the
// webServer array in playwright.config.ts), so no one has to remember to.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import * as Sentry from "@sentry/node";
import { messageFor, type AccountChanged } from "./messages.ts";
import { Outbox } from "./outbox.ts";

// The one failure this service can have that looks like success. Without
// `--import ./instrument.ts` the process still starts, still serves, and still
// records nothing into the trace the account API sent - it opens one of its
// own instead. Cheap to check, and a crash on line one is a far better report
// of it than a waterfall with a service missing.
if (!Sentry.isInitialized()) {
  throw new Error(
    "Sentry was not loaded before this module. Start with `yarn notifications:start`, " +
      "which passes --import ./server/Notifications/instrument.ts.",
  );
}

// The header the account service forwards, carrying the session it read off the
// browser. Not a cookie: no browser talks to this service, so there is no
// cookie to read and nothing to default to but the demo.
const SESSION_HEADER = "x-e2e-session";
const DEMO_SESSION = "demo";

const outbox = new Outbox();

/** The session this request belongs to, or the demo's. */
function sessionOf(request: IncomingMessage): string {
  const header = request.headers[SESSION_HEADER];
  const value = Array.isArray(header) ? header[0] : header;
  return value !== undefined && value !== "" ? value : DEMO_SESSION;
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage): Promise<AccountChanged> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as AccountChanged;
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  // A path without its query string. Nothing here reads one, but `req.url` is
  // the raw target and a `?` in it would miss every branch below.
  const path = new URL(request.url ?? "/", "http://localhost").pathname;

  // WHAT THIS REQUEST IS CALLED IN SENTRY. Left alone it is called `GET` - the
  // method and nothing else - because this SDK names a server transaction from
  // the route and a bare `node:http` server has no routes to name it from. All
  // three endpoints would then pile into one entry in the transaction list, and
  // the account API's `http.client` span would point at something called `POST`.
  //
  // Named here, where the routing actually happens, in the same words ASP.NET
  // Core produced for free: `POST /notifications/account-changed`. The paths are
  // fixed, so this is a description and not a cardinality risk - a service with
  // an id in its path would have to name the PATTERN, never the value.
  const activeSpan = Sentry.getActiveSpan();
  if (activeSpan !== undefined) {
    Sentry.updateSpanName(Sentry.getRootSpan(activeSpan), `${request.method ?? "GET"} ${path}`);
  }

  // Playwright's webServer polls this to know the process is up, and the
  // sampler in instrument.ts drops its trace by name.
  if (request.method === "GET" && path === "/health") {
    json(response, 200, { ok: true });
    return;
  }

  // The one thing this service is for. Called by the account API, never by a
  // browser - there is no proxy in front of it and no CORS to allow, which is
  // itself the point: the frontend did not change when the backend became two,
  // and it did not change again when half of it stopped being .NET.
  //
  // 202 rather than 200: accepted, to be sent. Here the sending is the same
  // breath, because the demo has no queue; the status is what it would still be
  // once it had one.
  if (request.method === "POST" && path === "/notifications/account-changed") {
    const change = await readBody(request);
    // A span of this service's own, under the transaction the SDK's HTTP
    // instrumentation opened for this request - which is itself under the
    // account API's `http.client` span, which is under the browser's
    // `PUT /api/account`. Four levels, three processes, two languages, one
    // trace.
    //
    // Written by hand because there is nothing here to instrument
    // automatically: the account API gets its `db.query` spans free from EF
    // Core, and a service that only renders a string has no library to get them
    // from. `startSpan` marks the span errored and rethrows if the callback
    // throws, which is the whole of the error handling the C# version wrote out.
    Sentry.startSpan({ op: "notification.send", name: "account changed" }, () => {
      outbox.record(sessionOf(request), messageFor(change));
      // The SHAPE, never the contents - the address is the one field a
      // notification is guaranteed to carry and the one Sentry has no business
      // holding. The same line ../Accounts/Program.cs draws on its own log, and
      // the same one `sendDefaultPii: false` draws for the SDK.
      Sentry.logger.info("Notification rendered", { langue: change.langue });
    });
    json(response, 202, null);
    return;
  }

  // Test-only: what this session was sent. Namespaced away from /notifications/
  // so it is obvious at the call site that it is not part of the surface the
  // account API talks to - the same split ../Accounts/Program.cs makes with
  // /__test__/account.
  //
  // This is what lets the E2E tier PROVE the hop rather than assume it: a save
  // in the browser, read back out of a different process, in a different
  // language, than the one that served it (../../e2e/account.spec.ts).
  if (request.method === "GET" && path === "/__test__/notifications") {
    json(response, 200, outbox.for(sessionOf(request)));
    return;
  }

  json(response, 404, { error: "Not found" });
}

const server = createServer((request, response) => {
  // ASP.NET Core's middleware turned a throw into a 500 and reported it; with
  // no framework, this is where that happens. It matters to the CALLER's trace
  // as much as to ours: the account API swallows the failure by design
  // (../Accounts/NotificationsClient.cs), and a 500 is what keeps its
  // `http.client` span red inside a save that succeeded.
  void handle(request, response).catch((error: unknown) => {
    Sentry.captureException(error);
    console.error(error);
    if (!response.headersSent) {
      json(response, 500, { error: "Internal server error" });
      return;
    }
    response.end();
  });
});

// The last events a process produces are the ones it is most often killed
// before sending. `concurrently -k` behind `yarn start`, Playwright's webServer
// teardown and a Ctrl-C all arrive as SIGTERM or SIGINT, and the SDK's batching
// means whatever it was holding goes with the process - silently, which is the
// worst way for an observability demo to lose an event. ASP.NET Core flushed on
// shutdown for the version of this service that came before; this is that.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close(() => {
      void Sentry.flush(2000).then(() => {
        process.exit(0);
      });
    });
  });
}

// 3002, beside the account API's 3001. Its own variable rather than `PORT`,
// because both services read the one .env and would otherwise fight over it.
// The .env itself is read by `node --env-file-if-exists=.env`, which the yarn
// script passes - the flag is cwd-relative and the script runs at the repo
// root, so it needs none of the upward walking DotNetEnv did for `dotnet run`.
const port = Number(process.env.NOTIFICATIONS_PORT ?? "3002");
server.listen(port, "localhost", () => {
  console.log(`Notifications service listening on http://localhost:${String(port)}`);
});
