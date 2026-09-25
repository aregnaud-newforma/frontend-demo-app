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

// A module rather than a script, for the top-level `await` below.
export {};

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
  // This service calls nothing over the network except Sentry, whose uploads
  // would otherwise show up in every trace as an outgoing request - with a DNS
  // lookup and a TCP connect under each. What the trace is for is the request
  // coming IN, so the outgoing half is switched off below, and these two with it.
  process.env.DD_TRACE_DISABLED_INSTRUMENTATIONS ??= "dns,net";

  await import("dd-trace/initialize.mjs");
  const { default: tracer } = await import("dd-trace");
  tracer.use("http", { client: false });
}
