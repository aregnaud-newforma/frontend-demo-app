// The account API, for real. A small HTTP server over Postgres so the E2E tier
// has an actual backend to talk to instead of an interceptor standing in for
// one, and so `yarn dev` shows data that outlives a restart.
//
// WHY IT EXISTS: every other tier mocks the network on purpose - the unit tests
// never touch it, the integration tests put MSW at the boundary so a component
// can be driven through states a real server would make slow or impossible to
// reach. E2E is the one tier whose whole job is to prove the pieces agree when
// nothing is standing in for anything, and a stubbed backend quietly takes that
// away: `route.fulfill()` cannot disagree with the frontend about a status code,
// a header, or how a JSON body is shaped, because it IS the frontend's own
// assumptions being played back at it.
//
// WHAT IT IS MADE OF: this file is the HTTP surface only. The tables are in
// AccountsDb.cs, the queries in Store.cs, the wire shapes in Account.cs - see
// docs/adr/0002-aspnet-core-and-ef-core-behind-the-api.md for why a demo of a
// React app carries a .NET process, and 0001 for why it carries a database.
//
// PER-TEST ISOLATION: Playwright runs specs in parallel (`fullyParallel`), and
// one shared backend would mean one spec's PUT changing what another spec's GET
// returns. So every row is keyed by a session id, which each test generates and
// puts in a cookie on its own browser context (see e2e/session.ts). The browser
// sends it with every request; the server reads it and sees only that test's
// data. This is the part a mocked backend never has to solve, and the part real
// E2E against a shared environment always does.
//
// A request that names no session gets DEMO_SESSION, which is seeded on first
// start - that is what makes `yarn dev` show an account rather than an error,
// since nothing outside the specs ever sets the cookie.
//
// Run it with `yarn api:start`, with the database from `yarn db:start` up.
// Playwright starts the API itself (see the webServer array in
// playwright.config.ts), so no one has to remember to.
using Api;
using Microsoft.EntityFrameworkCore;

// The repo's .env, walked up to from wherever `dotnet run` put the working
// directory. Before anything reads a variable: the connection string, the DSN
// and the port below all come from it. Missing is fine - CI sets its variables
// itself and has no .env.
DotNetEnv.Env.TraversePath().Load();

// The cookie the browser carries, and the header the seeding call sends.
const string SessionCookie = "e2e-session";
const string SessionHeader = "x-e2e-session";

// The session a request belongs to when it names none - which is every request
// from a browser someone opened themselves, since only the specs set the
// cookie. Without it `yarn dev` has no way to reach any data at all: the store
// starts empty and `/__test__/account` is the only thing that fills it.
//
// Seeded once, the first time the API starts against an empty database, and
// mutable like any other session: the form saves, the summary comes back
// changed, and the change is still there after a restart.
//
// A spec that forgets `startSession` lands here rather than on an error - but
// it still fails, and at the right place: its assertions name the random values
// it seeded, and this record matches none of them.
const string DemoSession = "demo";

var demoAccount = new Account(
    Id: "demo-account",
    Nom: "Durand",
    Prenom: "Camille",
    Email: "camille.durand@example.com",
    Telephone: "+33612345678", // stored in E.164, shown as 0612345678
    Langue: "fr",
    Bio: "Designs things, occasionally writes about them.");

// `Development` when nothing says otherwise. ASP.NET Core's own fallback is
// `Production`, which is the one value nearly never true of this process: a
// Properties/launchSettings.json is what usually sets it, and this project
// carries none so that `yarn api:start` and Playwright's webServer run the same
// command in the same environment. The name is what Sentry's `environment`
// below is built from.
var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    EnvironmentName = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? Environments.Development,
});

builder.WebHost.UseUrls($"http://localhost:{Environment.GetEnvironmentVariable("PORT") ?? "3001"}");

// The API's own Sentry, and the other half of a trace that starts in a browser.
//
// ../../src/sentry.ts already reports what the browser does, which gets the
// request to `/api/account` as far as an `http.client` span and no further: how
// long the server took, what it asked Postgres, and whether the query was the
// slow part all sit on the far side of a boundary that trace cannot cross. This
// is what puts them in the same trace - the browser attaches `sentry-trace` and
// `baggage` to every same-origin request on its own (its
// `tracePropagationTargets` is left unset, which is what that default means),
// the Vite proxy forwards them, and Sentry.AspNetCore reads them off the
// incoming request and continues the trace they name instead of starting a new
// one. Its middleware also names the transaction after the route (`GET
// /api/account`), captures whatever an endpoint throws before the framework
// turns it into a 500, and puts a `db.query` span under it for every EF Core
// query - all of that is on by default in this package, so none of it is
// written here.
//
// Off unless `SENTRY_DSN` is set, exactly as the browser half is off without
// `VITE_SENTRY_DSN`. That is what keeps CI quiet - .github/workflows/ci.yml sets
// DATABASE_URL and no DSN, so the failures its E2E specs provoke on purpose are
// reported to nobody. Note that this cuts the other way LOCALLY: `yarn e2e`
// starts the API through `yarn api:start`, which reads .env, so a DSN sitting
// there means the specs' own traffic is traced like any other.
//
// A DIFFERENT SENTRY PROJECT from the browser's, `alexisregnaud/frontend-demo-api`.
// A trace is linked by its id, not by its project, so the two halves still read
// as one trace - while a .NET stack and a React stack stay in separate issue
// streams, and the source-map upload in ../../vite.config.ts stays a
// frontend-only concern.
builder.WebHost.UseSentry(options =>
{
    options.Dsn = Environment.GetEnvironmentVariable("SENTRY_DSN");
    // `development`, `production`: the browser half sends Vite's `MODE`, and
    // these are the same words in the same case, so the two are one environment
    // in Sentry rather than `development` next to `Development`.
    options.Environment = builder.Environment.EnvironmentName.ToLowerInvariant();
    // WHICH BUILD this is, in the SAME WORDS as the browser half.
    //
    // Left alone this SDK does name the commit - the .NET SDK stamps the source
    // revision into the assembly's informational version, so the default reads
    // `Api@1.0.0+8ffc29c...`. What it does not do is MATCH: the browser's
    // release is the bare sha, put there by @sentry/vite-plugin
    // (../../vite.config.ts), so a search for one release finds one half of the
    // request and not the other, and the two projects cannot be compared over a
    // deploy.
    //
    // The same variable the JS tooling reads, so one
    // `SENTRY_RELEASE=$(git rev-parse HEAD)` covers both. Unset leaves the
    // SDK's own default - a name that is right but spelled differently.
    if (Environment.GetEnvironmentVariable("SENTRY_RELEASE") is { Length: > 0 } release)
    {
        options.Release = release;
    }
    // A sampler rather than a flat `TracesSampleRate`, for one reason:
    // Playwright's webServer polls /health until the process answers (see
    // ../../playwright.config.ts), and at a flat rate every poll is a trace of
    // its own - noise outnumbering the requests anyone opened Sentry to look at.
    //
    // The parent's decision first, whichever way it went: when the browser
    // already decided to sample this trace, that decision arrives in `baggage`
    // and is honoured, so no trace is ever recorded half-way. The fallback of 1
    // applies only to a request that named no trace - curl, or the seeding call
    // the E2E specs make - and matches the browser's own `tracesSampleRate: 1`.
    options.TracesSampler = context =>
    {
        if (context.TransactionContext.IsParentSampled is bool parentSampled)
        {
            return parentSampled ? 1 : 0;
        }
        return context.TransactionContext.Name == "GET /health" ? 0 : 1;
    };
    // Structured logs, OFF by default in this SDK. On, what the app writes
    // through `ILogger<T>` also goes to Sentry, stamped with the trace and the
    // span that were active when the line was written - which is what puts a
    // line this API logged inside the browser's trace, under the very span that
    // was serving the request.
    //
    // Worth knowing before turning it on anywhere real: the sampler above
    // governs traces, NOT logs. A request whose trace was dropped still sends
    // whatever it logged, so the rate limiting has to happen at the filter
    // below or in `SetBeforeSendLog`.
    options.EnableLogs = true;
    // The same thing the browser half now does (../../src/sentry.ts), on the
    // other side of the request: the trace says the PUT took 120ms and that
    // `db.query` was 90 of them, the profile says which .NET frames spent the
    // rest.
    //
    // `ProfilesSampleRate` multiplies the sampler above rather than replacing
    // it - 1.0 here means "every transaction that was already sampled", so the
    // /health polls the sampler drops are not profiled either.
    //
    // Worth saying out loud in a demo: Sentry marks .NET profiling ALPHA, on
    // .NET 8+ only. The integration starts the runtime profiler asynchronously,
    // so the first request or two after a start may carry no profile.
    options.ProfilesSampleRate = 1.0;
    options.AddProfilingIntegration();
    // `SendDefaultPii` is left at its default, which in this SDK is OFF - the
    // opposite of the browser's Sentry v11, where ../../src/sentry.ts has to
    // switch `dataCollection.userInfo` off by hand. Same outcome on both sides:
    // what debugs a slow query is the query; who asked for it is not.
});

builder.Services.AddDbContext<AccountsDb>(options => options.UseNpgsql(AccountsDb.ConnectionString()));

// EF Core prints every statement it runs at Information, which with no
// appsettings.json to say otherwise is the level this host logs at. The SQL
// is worth having, and it is already where it is worth having: on the
// `db.query` span Sentry attaches to the request. The terminal `yarn start`
// shares with Vite is not that place.
builder.Logging.AddFilter("Microsoft.EntityFrameworkCore", LogLevel.Warning);

// Sentry gets THIS app's logs, not the framework's running commentary.
// `EnableLogs` forwards everything the logging pipeline emits, and at
// Information - the level this host logs at - that is five lines out of Hosting
// and Routing for every single request ("Request starting", "Executing
// endpoint", ...) before one of ours is reached.
//
// Below Warning only, so a framework line that reports actual trouble still
// arrives. Matched on the provider rather than declared globally like the EF
// Core line above, because the two want opposite things: the terminal `yarn
// start` shares with Vite is where "Request finished" is worth reading, and
// Sentry is where it is a bill.
//
// A predicate and a name rather than the typed `AddFilter<SentryLoggerProvider>`
// overload: that type is internal to Sentry.Extensions.Logging and will not
// compile here. `provider` arrives as either the provider's full type name or
// its `[ProviderAlias]`, and "Sentry" is in both.
//
// Note the one thing this does NOT do: a log Sentry drops here is still written
// to the console, and it is still NOT a span. Spans come from the tracing
// middleware and answer to `TracesSampler` above instead.
builder.Logging.AddFilter((provider, category, level) =>
    level >= LogLevel.Warning
    || provider?.Contains("Sentry", StringComparison.Ordinal) != true
    || category?.StartsWith("Microsoft", StringComparison.Ordinal) != true);

var app = builder.Build();

// Bring the database up to date, then make sure `yarn dev` has something to
// show. Listening only starts after this, which is what lets Playwright's
// webServer read "answers /health" as "the database answered and the
// migrations ran".
using (var startup = app.Services.CreateScope())
{
    var db = startup.ServiceProvider.GetRequiredService<AccountsDb>();
    await db.Database.MigrateAsync();
    if (await Store.FindAccount(db, DemoSession) is null)
    {
        await Store.SaveAccount(db, DemoSession, demoAccount);
    }
}

// The account is per-session and mutable; a cached GET would show the pre-save
// value after a PUT and make the last assertion flake. On every response rather
// than every JSON helper, because there is no JSON helper to put it in.
app.Use(async (context, next) =>
{
    context.Response.Headers.CacheControl = "no-store";
    await next(context);
});

// Playwright's webServer polls this to know the process is up.
app.MapGet("/health", () => Results.Json(new { ok = true }));

// Test-only: put an account in this session's store. Namespaced away from
// /api/ so it is obvious at the call site that it is not part of the product
// surface the specs are exercising.
app.MapPut("/__test__/account", async (HttpRequest request, Account account, AccountsDb db) =>
    Results.Json(await Store.SaveAccount(db, ReadSession(request), account), statusCode: StatusCodes.Status201Created));

app.MapGet("/api/account", async (HttpRequest request, AccountsDb db) =>
    await Store.FindAccount(db, ReadSession(request)) is { } account ? Results.Json(account) : NoAccount());

app.MapPut("/api/account", async (HttpRequest request, AccountPayload payload, AccountsDb db, ILogger<Program> logger) =>
{
    if (await Store.UpdateAccount(db, ReadSession(request), payload) is not { } updated)
    {
        return NoAccount();
    }
    // The SHAPE of what was saved, never the contents - `SendDefaultPii` is off
    // for the same reason, and a log is not the place to go around it. Named
    // placeholders rather than interpolation: each one reaches Sentry as its
    // own searchable attribute, and the message stays one template to group by.
    logger.LogInformation(
        "Account updated (langue: {Langue}, phone: {HasTelephone})",
        updated.Langue,
        updated.Telephone is not null);
    return Results.Json(updated);
});

// A method these routes do not take is a 405, and a path none of them match a
// 404, both from the router and both with an empty body. The Node version wrote
// `{ error }` into those; nothing on the other end ever read it (see
// src/account/helpers/api.ts, which looks at `response.ok` and nothing else).

app.Run();

static string ReadSession(HttpRequest request)
{
    if (request.Headers.TryGetValue(SessionHeader, out var header) && !string.IsNullOrEmpty(header))
    {
        return header.ToString();
    }
    return request.Cookies.TryGetValue(SessionCookie, out var cookie) ? cookie : DemoSession;
}

static IResult NoAccount() =>
    Results.Json(new { error = "No account for this session" }, statusCode: StatusCodes.Status404NotFound);
