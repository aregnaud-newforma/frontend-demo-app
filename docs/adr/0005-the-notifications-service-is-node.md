---
status: accepted
date: 2026-09-24
---

# The notifications service is Node

`server/` is now **one ASP.NET Core process and one Node process**. The account
API (`server/Accounts/`) is unchanged: still .NET, still EF Core over Postgres,
still the only surface the browser reaches. The notifications service
(`server/Notifications/`) is a rewrite - `node:http`, TypeScript run through
Node's type stripping, `@sentry/node` - on the same port, the same three routes
and the same wire contract it had as ASP.NET Core.

The frontend is unchanged, and so is the account API. Not one line of
`server/Accounts/NotificationsClient.cs` moved, which is the cheapest possible
demonstration that ADR 0004 drew the boundary in the right place.

**One request is still one trace.** A save in the browser is a `PUT
/api/account` transaction, containing an `http.client` span to the API,
containing the API's own .NET transaction, containing its `db.query` spans and
an `http.client` span to 3002, containing the Node service's transaction and the
`notification.send` span inside it. Four levels, three processes, **two
runtimes**, one trace id.

## Why

ADR 0004 split the backend to ask whether the observability story survives more
than one service. It does - but both services were ASP.NET Core, so what it
actually proved was that a trace crosses two processes of the _same_ runtime
with the _same_ SDK. That is the case most likely to work by accident, and it is
not the case the products behind this demo are in: a real estate has a .NET API
next to a Node worker next to something else again.

A trace is linked by its id. Not by its project, which ADR 0004 already showed,
and not by its runtime, which is what this one shows. The mechanism is different
on each side and the propagation is the same two headers:

- **`Sentry.AspNetCore`** reads `sentry-trace` and `baggage` off an incoming
  request and continues the trace they name. That is the account API.
- **`@sentry/node`** does the same through OpenTelemetry's HTTP
  instrumentation, which patches `node:http` itself - so a server written
  against the bare module, with no framework and no route table, is instrumented
  anyway.

Neither knows what the other is. The account API's `http.client` span is opened
by the same `AddHttpClient<NotificationsClient>` line it always was, and the
headers it writes are read by an SDK in another language.

Picking the notifications service rather than the account API for this is not
arbitrary. It has no database, no migrations and no EF Core, so the rewrite is
the HTTP surface and a pure function; and .NET is what the products behind this
demo run behind their APIs (ADR 0002), so the service that stays .NET should be
the one that looks like theirs.

## Considered options

- **Rewrite the notifications service in Node, keep the account API in .NET.**
  Chosen. The smaller of the two services, the one with no persistence, and the
  one whose contract is three fields.
- **Leave both in .NET.** The honest default. Rejected for the reason ADR 0004
  itself gives about staying one process: the repository is a demonstration, and
  the thing being demonstrated is weaker without the second runtime.
- **A third service in a third language.** Proves the same point and costs a
  third `.csproj`-equivalent, a third Sentry project, a third entry in
  `playwright.config.ts` and a third thing to keep in step. Two runtimes is the
  whole of the claim.
- **Node with a framework (Fastify, Express).** Rejected: three fixed paths do
  not need a router, and a framework integration would hide the thing worth
  seeing - that the trace is continued by the HTTP layer, not by the framework.

## Consequences

- **`server/` is no longer a .NET solution.** It holds a `.slnx` with two
  projects and a folder of TypeScript. `server/**/*.ts` is in `tsconfig.json`'s
  `include`, so `yarn verify`'s `tsc --noEmit` type-checks it, and
  `server/**/*.unit.test.ts` is in the Vitest `unit` project. ADR 0002 said
  "`server/` is a .NET solution, so it leaves `tsconfig.json`, the Vitest `unit`
  project and the JS toolchain", which was true the day it was written; this
  line is where that trail picks up.
- **`yarn server:test` and `yarn server:build` are the account API's alone.**
  The notifications service's message rendering is
  `server/Notifications/messages.unit.test.ts` and runs under `yarn test` with
  every other unit test - the repository's rule that a test's filename decides
  its tier did not need an exception for it.
- **The shared setup is duplicated, in two languages.** The sampler, the
  `service` tag, the environment and the release now exist in
  `server/Accounts/SentrySetup.cs` and in
  `server/Notifications/instrument.ts`, and **nothing enforces that they
  agree**. This is the real price of the decision and it should be read as such:
  the two files are written to mirror each other decision for decision, and a
  future edit to one is an edit someone has to remember to make to the other.
  It is the same trade the `AccountChanged` shape already makes - except that
  one is protected by a compile error on the account's side and this one is
  protected by nothing.
- **Three places where the two SDKs cannot be written alike**, all commented in
  the files that hit them. Sentry's .NET SDK still has `EnableLogs`; the JS SDK
  removed it in v11 and sends logs always. The .NET SDK defaults
  `SendDefaultPii` to **off**; the JS SDK's v11 replacement, `dataCollection`,
  defaults every category **on** - including the incoming request body, which
  on this service is an email address, so `instrument.ts` has to turn it off
  explicitly. And the .NET setup filters `Microsoft.*` framework log noise,
  which a bare `node:http` server does not produce.
- **`server/Observability/` is gone.** ADR 0004 allowed it as "the one shared
  project… exactly because it carries no domain type". With one consumer left,
  it is not a boundary; `SentrySetup.cs` moved into `server/Accounts/` and
  `Accounts.csproj` names `Sentry.AspNetCore` and `Sentry.Profiling` directly.
  The MSBuild targets behind `SentryUploadSymbols` reach it the same way - the
  package ships them under `buildTransitive/`.
- **Nothing is uploaded to Sentry for this service.** Every other build in the
  repository hands over something so a stack trace reads: the browser's three
  builds upload source maps, the account API uploads PDBs with their sources
  embedded. Node runs the TypeScript directly, so a frame already says
  `server/Notifications/server.ts:42`, and the `SentryProject` /
  `SentryUploadSymbols` block that was in `Notifications.csproj` disappears with
  nothing replacing it. The DSN alone routes events to
  `demo-notifications-backend`.
- **The entry point is a flag, and getting it wrong fails silently.**
  `@sentry/node` has to patch `node:http` before anything imports it, which
  under ESM means `node --import ./server/Notifications/instrument.ts` ahead of
  the entry file. Without it the service still runs, still reports its errors,
  and starts a trace of its own per request instead of joining the account API's
  - the exact failure this ADR exists to rule out. `server.ts` therefore throws
    on `!Sentry.isInitialized()` rather than trusting the script.
- **Error handling is now explicit.** ASP.NET Core's middleware turned a throw
  into a 500 and reported it; the bare server catches, calls
  `Sentry.captureException` and writes the 500 itself. It matters to the
  caller's trace as much as its own: the account API swallows the failure by
  design, and the 500 is what keeps its `http.client` span red inside a save
  that succeeded.
- **The outbox lost its locks.** `ConcurrentDictionary` and a `lock` per list
  became a `Map` and an array: ASP.NET Core serves requests on whatever thread
  it has, Node serves them all on one.
