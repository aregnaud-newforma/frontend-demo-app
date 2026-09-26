---
status: accepted
date: 2026-09-25
---

# Datadog APM beside Sentry, by two roads

Datadog now traces the backend as well as the browser, **beside Sentry rather
than instead of it**, so the two tools can be compared on the same requests. A
save in the browser is one Datadog trace: the RUM resource for `PUT
/api/account`, the account API's request, its Postgres queries, its call to the
notifications service, and that service's request.

The two services reach Datadog by different roads:

- **The account API (.NET) uses OpenTelemetry**, exporting over OTLP to a local
  Datadog Agent (`server/Accounts/DatadogSetup.cs`).
- **The notifications service (Node) uses dd-trace**, Datadog's own tracer,
  sending to the same Agent (`server/Notifications/datadog.ts`).

Both are off unless `DD_AGENT_HOST` is set, and `yarn datadog:start` runs the
Agent from `compose.yaml`.

## Why two roads

Each service took the only road open to it.

- **Datadog's .NET tracer does not run on macOS.** It attaches to the runtime as
  a CLR profiler, built for Linux and Windows only, and the account API runs on
  macOS under `yarn start`. OpenTelemetry is a library, so it runs wherever .NET
  does, and the Agent ingests it natively.
- **The Node service cannot take a second OpenTelemetry SDK.** `@sentry/node`
  v11 is built on OpenTelemetry and registers the global tracer provider. A
  second SDK would compete for that global. dd-trace keeps its own state, so it
  and Sentry instrument the same `node:http` server without knowing about each
  other.

ADR 0004 set aside W3C `traceparent` and OpenTelemetry "until a third,
non-Sentry service exists". Datadog is that third party, and `traceparent` is
now how its trace crosses every hop.

## Who owns which header

Two tracers now continue the same request, and each reads and writes its own
headers:

| Header                      | Owner   | Written by                        |
| --------------------------- | ------- | --------------------------------- |
| `sentry-trace`, `baggage`   | Sentry  | every Sentry SDK, as before       |
| `traceparent`, `tracestate` | Datadog | RUM, then the API's OpenTelemetry |

**`baggage` stays Sentry's alone**, because it carries Sentry's sampling
decision from the browser (ADR 0004). Each Datadog side is set so it neither
reads nor writes it:

- **Browser:** RUM runs with `propagateTraceBaggage: false`.
- **.NET:** both the runtime's propagator and OpenTelemetry's are W3C-only.
  Otherwise .NET's default would copy the incoming `baggage` onto the call to
  the notifications service, where Sentry.AspNetCore already writes one.
- **Node:** dd-trace extracts `tracecontext,datadog` only.

## Consequences

- **Two sampling policies.** Sentry samples in each service's `TracesSampler`.
  Datadog follows the browser's decision (OpenTelemetry's default
  `ParentBased`) and drops the `/health` polls at the Agent
  (`DD_APM_IGNORE_RESOURCES`).
- **The setup is now written three times.** `SentrySetup.cs` and
  `instrument.ts` already had to agree, and `DatadogSetup.cs` and `datadog.ts`
  are a second pair that has to agree in the same way. They use the same
  service names (`account-api`, `notifications`) and the same environment and
  version words, so one search finds a request in either tool.
- **CI traces nothing.** No job sets `DD_AGENT_HOST`, and CI runs no Agent.
- **Each tracer skips the other's traffic.** Sentry uploads its envelopes over
  HTTP from inside the request, so each Datadog tracer is set to leave those
  calls out of the trace.
- **One profiler per process.** Two profilers sampling the same V8 isolate
  would skew each other, so the notifications service is profiled by Datadog
  whenever dd-trace runs, and by Sentry only when it does not
  (`DD_PROFILING_ENABLED`). The account API stays with Sentry's profiler, for
  the same reason it cannot run Datadog's tracer.
  The browser follows the same rule: Datadog RUM profiles the page whenever it
  runs, and Sentry's browser profiling is left out then.
- **Logs take the same two roads.** The account API sends its `ILogger` output
  over OTLP beside its traces, and each record carries the current trace and
  span. The notifications service cannot: dd-trace's OpenTelemetry logs install
  a global context manager, which is Sentry's here. It sends JSON lines stamped
  with `dd.trace_id` to a UDP port the Agent collects from
  (`server/Notifications/datadog-logs.yaml`) - the local stand-in for the
  stdout a deployed Agent collects. Not a file the Agent tails: through Docker
  Desktop's file sharing it reads a bind-mounted file one write behind.
