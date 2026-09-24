namespace Accounts;

/// <summary>
/// This service's Sentry setup, in one place away from Program.cs.
/// </summary>
public static class SentrySetup
{
    /// <summary>
    /// Error reporting, tracing, profiling and structured logs for the account
    /// API.
    ///
    /// <para>
    /// THIS FILE USED TO BE A SHARED PROJECT. <c>server/Observability/</c> held
    /// it while both backend services were ASP.NET Core and both could
    /// reference it. Now that the notifications service is Node
    /// (docs/adr/0005), it has one consumer, and a library with one consumer is
    /// not a boundary - so it moved in here. Its twin is
    /// <c>../Notifications/instrument.ts</c>: the same decisions in another
    /// language, with nothing enforcing that the two agree. That is the price
    /// of a polyglot backend and docs/adr/0005 is where it is written down.
    /// </para>
    ///
    /// <para>
    /// WHAT MAKES THE TWO SERVICES ONE TRACE. Nothing in here, which is the
    /// point worth knowing: <c>Sentry.AspNetCore</c> reads <c>sentry-trace</c>
    /// and <c>baggage</c> off every incoming request and continues the trace
    /// they name, and its HTTP client filter puts the same two headers on every
    /// outgoing request made through an <c>HttpClient</c> the factory built. So
    /// the browser's trace reaches this API, and this API's reaches the
    /// notifications service, with no code on either side beyond
    /// <c>AddHttpClient()</c> - and the Node SDK on the far end continues it the
    /// same way, off the same two headers. See docs/adr/0004.
    /// </para>
    ///
    /// <para>
    /// Off unless <c>SENTRY_DSN</c> is set. That is what keeps CI quiet -
    /// .github/workflows/ci.yml sets DATABASE_URL and no DSN, so the failures
    /// its E2E specs provoke on purpose are reported to nobody. Note that this
    /// cuts the other way LOCALLY: `yarn e2e` starts both services through
    /// their `yarn` scripts, which read .env, so a DSN sitting there means the
    /// specs' own traffic is traced like any other.
    /// </para>
    /// </summary>
    public static void AddDemoObservability(this WebApplicationBuilder builder)
    {
        builder.WebHost.UseSentry(options =>
        {
            // A DIFFERENT SENTRY PROJECT from the browser's,
            // `alexisregnaud/demo-account-backend`. A trace is linked by its id,
            // not by its project, so all three parts still read as one trace -
            // while a .NET stack and a React stack stay in separate issue
            // streams.
            options.Dsn = Environment.GetEnvironmentVariable("SENTRY_DSN");
            // `development`, `production`: the browser half sends Vite's `MODE`,
            // the notifications service sends `NODE_ENV`, and these are the same
            // words in the same case, so the three are one environment in Sentry
            // rather than `development` next to `Development`.
            options.Environment = builder.Environment.EnvironmentName.ToLowerInvariant();
            // WHICH SERVICE this is, on everything it sends. The projects
            // already separate the two backends when each has a DSN of its own;
            // this is what separates them when they share one, which is the
            // default (see ../../.env.example) and the shape most people will
            // run the demo in. `../Notifications/instrument.ts` sets the same
            // tag to "notifications".
            options.DefaultTags["service"] = "account-api";
            // WHICH BUILD this is, in the SAME WORDS as the browser half.
            //
            // Left alone this SDK does name the commit - the .NET SDK stamps the
            // source revision into the assembly's informational version, so the
            // default reads `Accounts@1.0.0+8ffc29c...`. What it does not do is
            // MATCH: the browser's release is the bare sha, put there by
            // @sentry/vite-plugin (../../vite.config.ts), so a search for one
            // release finds one part of the request and not the others, and the
            // projects cannot be compared over a deploy.
            //
            // The same variable the JS tooling reads, so one
            // `SENTRY_RELEASE=$(git rev-parse HEAD)` covers every build. Unset
            // leaves the SDK's own default - a name that is right but spelled
            // differently.
            if (Environment.GetEnvironmentVariable("SENTRY_RELEASE") is { Length: > 0 } release)
            {
                options.Release = release;
            }
            // A sampler rather than a flat `TracesSampleRate`, for one reason:
            // Playwright's webServer polls /health on both services until they
            // answer (see ../../playwright.config.ts), and at a flat rate every
            // poll is a trace of its own - noise outnumbering the requests
            // anyone opened Sentry to look at.
            //
            // The parent's decision first, whichever way it went. This is the
            // line that matters most once there is more than one service: the
            // browser decides whether to sample, that decision rides in
            // `baggage` to this API and on to the notifications service, and
            // every hop honours it. Without it a trace could be recorded at one
            // hop and dropped at the next, which is a trace with a hole in it
            // rather than a trace. `../Notifications/instrument.ts` runs the
            // same two decisions in the same order.
            //
            // The fallback of 1 applies only to a request that named no trace -
            // curl, or the seeding call the E2E specs make - and matches the
            // browser's own `tracesSampleRate: 1`.
            options.TracesSampler = context =>
            {
                if (context.TransactionContext.IsParentSampled is bool parentSampled)
                {
                    return parentSampled ? 1 : 0;
                }
                return context.TransactionContext.Name == "GET /health" ? 0 : 1;
            };
            // Structured logs, OFF by default in this SDK. On, what this service
            // writes through `ILogger<T>` also goes to Sentry, stamped with the
            // trace and the span that were active when the line was written.
            //
            // Worth knowing before turning it on anywhere real: the sampler
            // above governs traces, NOT logs. A request whose trace was dropped
            // still sends whatever it logged, so the rate limiting has to happen
            // at the filter below or in `SetBeforeSendLog`.
            options.EnableLogs = true;
            // The same thing the browser half does (../../src/sentry.ts), on the
            // other side of the request: the trace says the PUT took 120ms and
            // that `db.query` was 90 of them, the profile says which .NET frames
            // spent the rest.
            //
            // `ProfilesSampleRate` multiplies the sampler above rather than
            // replacing it - 1.0 here means "every transaction that was already
            // sampled", so the /health polls the sampler drops are not profiled
            // either.
            //
            // Worth saying out loud in a demo: Sentry marks .NET profiling
            // ALPHA, on .NET 8+ only. The integration starts the runtime
            // profiler asynchronously, so the first request or two after a start
            // may carry no profile.
            options.ProfilesSampleRate = 1.0;
            options.AddProfilingIntegration();
            // `SendDefaultPii` is left at its default, which in this SDK is OFF -
            // the opposite of the browser's Sentry v11, where
            // ../../src/sentry.ts has to switch `dataCollection.userInfo` off by
            // hand. Same outcome everywhere: what debugs a slow query is the
            // query; who asked for it is not.
            //
            // It has a second effect now that there are two services. With PII
            // on, the SDK would also put the machine name on every event as
            // `ServerName`; off, the only thing naming the sender is the
            // `service` tag above, which is the one we chose.
        });

        // Sentry gets THIS service's logs, not the framework's running
        // commentary. `EnableLogs` forwards everything the logging pipeline
        // emits, and at Information - the level this host logs at - that is
        // five lines out of Hosting and Routing for every single request
        // ("Request starting", "Executing endpoint", ...) before one of ours is
        // reached. The notifications service has no counterpart to this, because
        // a raw node:http server writes no such commentary to filter.
        //
        // Below Warning only, so a framework line that reports actual trouble
        // still arrives. Matched on the provider rather than declared globally,
        // because the two want opposite things: the terminal `yarn start` shares
        // with Vite is where "Request finished" is worth reading, and Sentry is
        // where it is a bill.
        //
        // A predicate and a name rather than the typed
        // `AddFilter<SentryLoggerProvider>` overload: that type is internal to
        // Sentry.Extensions.Logging and will not compile here. `provider`
        // arrives as either the provider's full type name or its
        // `[ProviderAlias]`, and "Sentry" is in both.
        //
        // Note the one thing this does NOT do: a log Sentry drops here is still
        // written to the console, and it is still NOT a span. Spans come from
        // the tracing middleware and answer to `TracesSampler` above instead.
        builder.Logging.AddFilter((provider, category, level) =>
            level >= LogLevel.Warning
            || provider?.Contains("Sentry", StringComparison.Ordinal) != true
            || category?.StartsWith("Microsoft", StringComparison.Ordinal) != true);
    }
}
