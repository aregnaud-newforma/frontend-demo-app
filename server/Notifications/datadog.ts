// Datadog APM for this service, beside Sentry rather than instead of it - the
// Node half of what ../Accounts/DatadogSetup.cs is on the .NET side, and the
// last hop of a trace that starts in the browser's RUM. docs/adr/0008 says why
// the two services reach Datadog by different roads.
//
// dd-trace and not OpenTelemetry, because Sentry's Node SDK already IS an
// OpenTelemetry setup: it registers the global tracer provider, and a second
// SDK would fight it for that global. dd-trace keeps its own, so the two
// instrument the same `node:http` server without knowing about each other.
//
// Loaded by `node --import` ahead of ./instrument.ts, for the reason that file
// gives: the patching has to happen before server.ts holds `node:http`, and
// `dd-trace/initialize.mjs` registers the ESM loader hook that does it.
//
// Off unless DD_AGENT_HOST is set - the one variable that turns APM on for both
// services (see ../../.env.example). Unset, the tracer is never started, which
// is what CI and the E2E job want: there is no Agent there to send to.

import { createSocket, type Socket } from "node:dgram";
import type { Tracer } from "dd-trace";

// WHICH BUILD this is, when nothing said: the commit `yarn notifications:start`
// passes as GIT_COMMIT, the bare sha the browser's builds report too
// (../../vite.base.ts). Read after --env-file, so a SENTRY_RELEASE the .env sets
// still wins, and here because this file runs first: DD_VERSION below and
// ./instrument.ts's release both read the result.
if (!process.env.SENTRY_RELEASE && process.env.GIT_COMMIT) {
  process.env.SENTRY_RELEASE = process.env.GIT_COMMIT;
}

let tracer: Tracer | undefined;
let logSocket: Socket | undefined;

if (process.env.DD_AGENT_HOST) {
  // dd-trace reads its configuration from the environment as it initialises,
  // so these are set before the import rather than passed to `init()`. `??=`
  // leaves any value .env already gave.
  //
  // `service` is Sentry's tag for this process (./instrument.ts), and `env`
  // and `version` are the words every other part uses, so one search finds the
  // whole request in either tool.
  process.env.DD_SERVICE ??= "notifications";
  process.env.DD_ENV ??= process.env.NODE_ENV ?? "development";
  if (process.env.SENTRY_RELEASE) process.env.DD_VERSION ??= process.env.SENTRY_RELEASE;
  // W3C `traceparent` first, because that is what the account API's
  // OpenTelemetry writes. NOT `baggage`, which dd-trace would otherwise read and
  // write as well: that header belongs to Sentry, and carries its sampling
  // decision from the browser to here (docs/adr/0004).
  process.env.DD_TRACE_PROPAGATION_STYLE ??= "tracecontext,datadog";
  // Traces only. Runtime metrics go to a DogStatsD port the Agent in
  // compose.yaml does not open, and the startup banner is a screen of JSON in
  // the terminal `yarn start` shares with three other processes.
  process.env.DD_RUNTIME_METRICS_ENABLED ??= "false";
  process.env.DD_TRACE_STARTUP_LOGS ??= "false";
  // The profiler, though, INSTEAD of Sentry's: ./instrument.ts reads this
  // variable and leaves its own off, because two profilers sampling one V8
  // isolate would skew both. Profiles go through the Agent's trace port and
  // link to the spans they sampled, the way Sentry's link to its transactions.
  // "false" in .env gives profiling back to Sentry.
  process.env.DD_PROFILING_ENABLED ??= "true";
  // This service calls nothing over the network except Sentry, whose uploads
  // would otherwise show up in every trace as an outgoing request - with a DNS
  // lookup and a TCP connect under each. What the trace is for is the request
  // coming IN, so the outgoing half is switched off below, and these two with it.
  process.env.DD_TRACE_DISABLED_INSTRUMENTATIONS ??= "dns,net";

  await import("dd-trace/initialize.mjs");
  ({ default: tracer } = await import("dd-trace"));
  tracer.use("http", { client: false });

  // Where this service's logs go for Datadog: a UDP port the Agent listens on
  // (./datadog-logs.yaml), the Agent collecting them as a deployed one collects
  // stdout. Not a file it tails: through Docker Desktop's file sharing the
  // Agent reads a bind-mounted file one write behind, so the last line before a
  // quiet spell never arrives. And not OpenTelemetry's logs API, which the
  // account API uses: dd-trace's version of it installs a global context
  // manager, and that global is Sentry's here.
  //
  // Unreferenced, so an open socket never keeps the process alive.
  logSocket = createSocket("udp4").unref();
}

/**
 * One log line for Datadog, as JSON, stamped with the trace and span active
 * when it was written - `dd.trace_id` is what Datadog joins a log to its trace
 * by - and with the service, env and version the tracer runs under. A no-op
 * when the tracer is off.
 */
export function datadogLog(
  status: "info" | "error",
  message: string,
  attributes: Record<string, unknown> = {},
) {
  if (!tracer || !logSocket) return;
  const record = { timestamp: new Date().toISOString(), status, message, ...attributes };
  const span = tracer.scope().active();
  if (span) tracer.inject(span, "log", record);
  logSocket.send(`${JSON.stringify(record)}\n`, 10518, process.env.DD_AGENT_HOST);
}
