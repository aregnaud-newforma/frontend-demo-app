---
status: accepted
date: 2026-09-24
---

# Micro-services behind the API

The backend is two ASP.NET Core processes. The **account API** (`server/Accounts/`)
keeps the surface it always had - `/api/account`, the `/__test__/account`
seeding route, `/health`, the `e2e-session` cookie, port 3001 - and owns the
`accounts` table. The **notifications service** (`server/Notifications/`) is
new: it listens on 3002, owns what a message to a person says, has no database,
and is reached only by the account API, over HTTP, when an account changes.

The frontend is unchanged. No new origin, no proxy entry, no CORS: the browser
still talks to one API, which is what makes this a decision the frontend never
has to know about - the same claim ADR 0002 made when the backend stopped being
Node.

**One request is still one trace.** A save in the browser is a `PUT
/api/account` transaction in `frontend-demo-app`, containing an `http.client`
span to the API, containing the API's own transaction in `frontend-demo-api`,
containing its `db.query` spans and an `http.client` span to 3002, containing
the notifications service's transaction in `frontend-demo-notifications` and the
`notification.send` span inside it. Four levels, three processes, three Sentry
projects, one trace id.

## How the trace crosses

Nothing in this repository propagates a trace by hand, and the list of what
does the work is short:

- **The browser** attaches `sentry-trace` and `baggage` to every same-origin
  request. `tracePropagationTargets` is left unset in `src/sentry.ts`, and that
  default means "same origin".
- **`Sentry.AspNetCore`** reads those two headers off an incoming request and
  continues the trace they name rather than starting a new one. Both services
  get this from being ASP.NET Core apps with a DSN.
- **`builder.Services.AddHttpClient<NotificationsClient>(...)`** is the line
  that makes the second hop visible. Sentry registers a message handler filter
  on the HTTP client factory, so every client the factory builds attaches the
  same two headers on the way out and opens an `http.client` span for the call.
  A `new HttpClient()` would still reach the notifications service and would
  show two unrelated traces instead of one.
- **The sampling decision travels with it.** Both services share one
  `TracesSampler` (`server/Observability/SentrySetup.cs`) that honours
  `IsParentSampled` before anything else, so a trace the browser chose to keep
  is kept at every hop. Without that, a trace can be recorded at one service and
  dropped at the next, which is a trace with a hole in it.

What Sentry gives back is the **trace waterfall** and, since February 2026,
cross-event querying in Trace Explorer - searching for spans by what the rest of
their trace contains, such as every trace where the notifications service logged
an error. What it does not give is a service map: there is no dependency graph
view, and the way you see that the account API depends on notifications is by
opening a trace that says so. Navigating between projects inside one trace is a
Business-plan feature; the trace itself is linked by id regardless.

## Why

The repository demonstrates the stack a product would ship, and the question it
could not answer was whether the observability story survives a backend split -
which is the split the products behind this demo are making. Everything about
tracing here was being shown across exactly one boundary, the browser to the
API, and a single boundary is the case that works by accident. The interesting
failures start at the second: a save that succeeds while a downstream call does
not, a service that samples differently from its caller, a fault that is one
incident and two issue streams.

Sending a notification was chosen as the seam because it is a real one. Telling
someone their details changed is not the account store's job, it is on the write
path where latency and failure are worth seeing, and it needs three fields of
the account and nothing else - so the contract between the two services is small
enough to read in full.

Independent deployment is the only reason to pay for this, exactly as in ADR 0003. Two services that always ship together are one service with a network call
in the middle.

## Considered options

- **The Sentry SDK in every service, headers propagated automatically.**
  Chosen. It is what both services already run for their own errors, the
  propagation is two lines of setup, and it needs no collector process.
- **OpenTelemetry instrumentation, exported to Sentry.** `Sentry.OpenTelemetry`
  swaps Sentry's HTTP handler for OTel's, or an OTLP collector forwards traces
  to Sentry. The right answer for an estate where some services are not
  instrumented by Sentry, and the wrong one here: it adds a moving part to
  demonstrate a hop that already works without it. Sentry also does not ingest
  OTLP metrics yet, only traces and logs.
- **W3C `traceparent` only.** `PropagateTraceparent` sends the standard header
  alongside Sentry's, for services that speak OTel and not Sentry. Off, because
  both ends here are Sentry; turn it on the day a third one is not.
- **A queue between the two services.** Closer to what a real notification path
  looks like, and the trace can still be joined - `SentrySdk.GetTraceHeader()`
  and `GetBaggage()` on the way in, `ContinueTrace()` on the way out. Rejected
  as a second subject: it would demonstrate message-queue propagation rather
  than service-to-service propagation, and it needs a broker in `compose.yaml`,
  in CI, and in the E2E tier.
- **Leaving the backend as one process.** The honest default for an app this
  size, and the reason this ADR exists is that the repository is a demonstration
  and not an app this size.

## Consequences

- `yarn start` runs three processes and the frontend's three;
  `yarn notifications:start` addresses the new one alone. The E2E tier starts
  five servers and waits on each, `/health` on both services included.
- **The two services do not share a domain type.** `AccountChanged` is declared
  twice - `server/Notifications/Messages.cs` and
  `server/Accounts/NotificationsClient.cs` - and the projects do not reference each
  other. That duplication is the boundary: a shared record would be a shared
  assembly, and a shared assembly is two services that deploy together.
  `server/Observability/` is the one shared project and it is allowed exactly
  because it carries no domain type.
- **A notification cannot fail a save.** `NotificationsClient` swallows every
  exception and logs a warning, because the account is already written by the
  time it runs. That is the correct trade and it is also how a fault becomes
  invisible in logs - the failed `http.client` span inside a successful
  transaction is what keeps it visible, plus an event of its own on a 5xx
  (`CaptureFailedRequests` is on by default) and the notifications service's own
  exception in its own project.
- **The call is awaited**, so the span nests inside the PUT and the E2E tier can
  read the notification back the moment the save returns. A save therefore waits
  on a service it does not need; the client's timeout is 5 seconds rather than
  the 100-second default so a hung service cannot hold a visitor's request open.
- **Each service has its own Sentry project**, and its own `SentryProject` in
  its `.csproj` so its Release build uploads its symbols there.
  `SENTRY_DSN_NOTIFICATIONS` falls back to `SENTRY_DSN`, so the demo runs with
  one DSN set; the `service` tag on every event is what tells the two apart when
  it does.
- **The notifications service keeps nothing.** Its outbox is in memory, keyed by
  session so parallel E2E specs stay isolated across the hop. A real one would
  have a queue in front of it rather than a table behind it.
- `yarn server:build` now builds the whole solution in Release, so both services'
  debug files reach Sentry on one token.
- **`server/Api/` is `server/Accounts/`.** With two services, one named after a
  subject and one named after a layer was the inconsistency `src/` never had, and
  "the API" stopped being a distinguishing word the moment both were one. Plural,
  because the folder holds a record called `Account` and `Accounts.Account` reads
  better than `Account.Account`; it also matches the `accounts` table and
  `AccountsDb`. The scripts moved with it - `accounts:start` for the service,
  `server:test` and `server:build` for the solution. ADR 0002 still says
  `server/Api/`, which was true the day it was written; this line is where the
  trail picks up. The Sentry project kept the name `frontend-demo-api` the day
  this was written, on the grounds that renaming one breaks saved queries and
  alerts for a cosmetic gain; the next line is where THAT trail picks up.
- **The Sentry projects are `demo-<subject>-<tier>`.** `frontend-demo-app`,
  `-account`, `-home`, `-api` and `-notifications` are now `demo-shell-frontend`,
  `demo-account-frontend`, `demo-home-frontend`, `demo-account-backend` and
  `demo-notifications-backend` - a project reads as a subject and the side it
  runs on, the way the folders do, and the backend of the account subject stops
  being "the API". The DSNs were not part of it: a DSN carries the project id,
  so nothing that reports had to change. What did is the slug each build uploads
  to - `vite.base.ts` and both `.csproj` files - and every saved query or alert
  written against the old slug.
- **The web's three are `demo-web-<subject>-frontend`.** When `apps/mobile`
  arrived with `demo-mobile-frontend` (docs/adr/0007), "frontend" stopped
  naming one platform, so `demo-shell-frontend`, `demo-account-frontend` and
  `demo-home-frontend` became `demo-web-shell-frontend`,
  `demo-web-account-frontend` and `demo-web-home-frontend`. The same rule as
  above held: the DSNs did not change, the slug in `vite.base.ts` did.
