// Everything this service says to Sentry, and nothing else.
//
// WHY IT IS ITS OWN FILE AND NOT A FUNCTION server.ts CALLS: the SDK works by
// patching `node:http` before anything holds a reference to it, and under ESM
// that patching happens in a module loader hook. A hook registered from inside
// server.ts would be too late - its own `import` of `node:http` is evaluated
// first. So this file is loaded by `node --import`, ahead of the entry point,
// which is what the `notifications:start` script in ../../package.json does.
// Get that wrong and nothing breaks loudly: the service runs, reports its
// errors, and starts a trace of its OWN for every request instead of joining
// the one the account API sent - the exact failure docs/adr/0005 exists to
// rule out.
//
// This is the Node half of what ../Accounts/SentrySetup.cs is on the .NET
// side. The two are deliberately the same setup in two languages, and nothing
// enforces that they agree - docs/adr/0005 is where that cost is written down.
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

const datadogProfiles = process.env.DD_PROFILING_ENABLED === "true";

Sentry.init({
  // ITS OWN SENTRY PROJECT, `alexisregnaud/demo-notifications-backend`, when
  // SENTRY_DSN_NOTIFICATIONS is set - so a stack from this service is its
  // team's, in its own issue stream, the way a remote's is on the frontend
  // (docs/adr/0003). Falling back to the account API's DSN rather than to
  // nothing, for the same reason a remote falls back to the shell's: the demo
  // has to be worth running with one DSN set, and a service reporting into a
  // neighbour's project still shows the split - the `service` tag below is
  // what tells the two apart there.
  //
  // Either way the TRACE is one. A trace is linked by its id, not by its
  // project, and - since this service stopped being .NET - not by its runtime
  // either.
  //
  // Undefined leaves Sentry off, which is what CI wants: .github/workflows/ci.yml
  // sets no DSN, so the failures its E2E specs provoke on purpose are reported
  // to nobody.
  dsn: process.env.SENTRY_DSN_NOTIFICATIONS ?? process.env.SENTRY_DSN,
  // `development`, `production`: the browser half sends Vite's `MODE` and the
  // account API lowercases ASP.NET Core's environment name, so all three are
  // one environment in Sentry rather than three spellings of it. NODE_ENV is
  // the variable that carries it here, and unset means the same default the
  // other two have.
  environment: process.env.NODE_ENV ?? "development",
  // WHICH BUILD this is, in the same words as every other part. Unset is fine;
  // the parts just stop lining up in a release comparison. One
  // `SENTRY_RELEASE=$(git rev-parse HEAD)` covers the browser's three builds,
  // the account API and this.
  release: process.env.SENTRY_RELEASE,
  // The same thing the browser half does (../../src/sentry.ts) and the account
  // API does, on the third side of the request: the trace says the POST took
  // 12ms, the profile says which frames spent them.
  //
  // UNLESS DATADOG PROFILES THIS PROCESS, which ./datadog.ts turns on whenever
  // it starts the tracer and says so in DD_PROFILING_ENABLED before this file
  // runs. Both profilers sample the same V8 isolate, so running the two would
  // make each one's overhead look worse than it is alone. One at a time, and
  // Datadog's when there is an Agent to send to.
  integrations: datadogProfiles ? [] : [nodeProfilingIntegration()],
  // A sampler rather than a flat `tracesSampleRate`, and the same one
  // ../Accounts/SentrySetup.cs runs, decision for decision.
  //
  // The parent's decision FIRST, whichever way it went. This is the line that
  // matters most once there is more than one service: the browser decides
  // whether to sample, that decision rides in `baggage` to the account API and
  // on to this process, and every hop honours it. Without it a trace could be
  // recorded at one hop and dropped at the next, which is a trace with a hole
  // in it rather than a trace.
  //
  // The fallback applies only to a request that named no trace - curl, or
  // Playwright's webServer polling /health until this process answers (see
  // ../../playwright.config.ts). At a flat rate every one of those polls would
  // be a trace of its own, noise outnumbering the requests anyone opened Sentry
  // to look at.
  //
  // ON `url.path` AND NOT ON `name`, which is where the .NET version cannot be
  // copied across. ASP.NET Core hands its sampler a routed name - `GET /health`
  // - because it has a route table. This SDK samples before any handler runs
  // and, with no framework to name the route, calls every transaction after the
  // METHOD alone: the `name` here is `"GET"` for the health poll and for
  // everything else. `url.path` is on the attributes from the start and is the
  // only thing that tells them apart. (server.ts renames the span afterwards,
  // which is too late to matter to this decision.)
  tracesSampler: ({ attributes, parentSampled }) => {
    if (parentSampled !== undefined) {
      return parentSampled;
    }
    return attributes?.["url.path"] === "/health" ? 0 : 1;
  },
  // Structured logs have NO switch here, and that absence is the point - the
  // same one ../../src/sentry.ts makes on the browser side: v9 and v10 wanted
  // `enableLogs: true`, v11 removed the option and sends them always.
  // `beforeSendLog` is the only control left. The .NET SDK still has the flag,
  // so `../Accounts/SentrySetup.cs` sets it and this file cannot - one of the
  // small places where the two halves of the setup cannot be written alike.
  //
  // What also has no counterpart here is the .NET setup's log FILTER: that one
  // exists to mute five lines of Hosting and Routing commentary per request,
  // and a raw `node:http` server writes none. The only logs this service sends
  // are the ones server.ts writes on purpose.
  //
  // Worth knowing anywhere real: the sampler above governs traces, NOT logs. A
  // request whose trace was dropped still sends whatever it logged.
  // `profileLifecycle: "trace"` ties a profile to a sampled transaction rather
  // than running the profiler continuously, so the /health polls the sampler
  // drops are not profiled either - the same relationship
  // `ProfilesSampleRate` has to the sampler on the .NET side.
  profileSessionSampleRate: datadogProfiles ? 0 : 1,
  profileLifecycle: "trace",
  // WHAT THIS SERVICE DOES NOT SEND, spelled out rather than left to a default,
  // because the default here is the opposite of the one the .NET half had.
  // `SendDefaultPii` is OFF by default in the .NET SDK; the JS SDK's v11
  // replacement for it, `dataCollection`, is ON in every category. Left alone,
  // the incoming request BODY of every POST this service serves would reach
  // Sentry - and that body is an email address. The one field a notification is
  // guaranteed to carry is the one Sentry has no business holding.
  //
  // `httpBodies: []` is the line that matters; the rest close the same door on
  // headers, cookies and query params. What debugs a slow request is the
  // request; who asked for it is not.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
  },
  // WHICH SERVICE this is, on everything it sends - the counterpart of
  // `DefaultTags["service"]` in ../Accounts/SentrySetup.cs. The projects already
  // separate the two backends when each has a DSN of its own; this is what
  // separates them when they share one, which is the default (see
  // ../../.env.example) and the shape most people will run the demo in.
  //
  // On `initialScope` rather than a `Sentry.setTag` call after init: this SDK
  // forks an isolation scope per request, and they inherit from this one. A tag
  // set on whatever scope happened to be current at startup is a tag that may
  // or may not be on the event you are looking at.
  initialScope: { tags: { service: "notifications" } },
});
