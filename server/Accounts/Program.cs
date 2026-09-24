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
// AccountsDb.cs, the queries in Store.cs, the wire shapes in Account.cs, the
// per-test isolation in Session.cs - see
// docs/adr/0002-aspnet-core-and-ef-core-behind-the-api.md for why a demo of a
// React app carries a .NET process, and 0001 for why it carries a database.
//
// WHAT IT IS NOT: the whole backend. Telling someone their account changed
// belongs to the notifications service (../Notifications/Program.cs), which
// this one calls over HTTP through NotificationsClient.cs. docs/adr/0004 is why
// the backend is two processes and what that costs.
//
// A request that names no session gets the demo one, which is seeded on first
// start - that is what makes `yarn dev` show an account rather than an error,
// since nothing outside the specs ever sets the cookie.
//
// Run it with `yarn accounts:start`, with the database from `yarn db:start` up and
// the notifications service from `yarn notifications:start` beside it.
// Playwright starts all of them (see the webServer array in
// playwright.config.ts), so no one has to remember to.
using Accounts;
using Microsoft.EntityFrameworkCore;
using Observability;

// The repo's .env, walked up to from wherever `dotnet run` put the working
// directory. Before anything reads a variable: the connection string, the DSN
// and the port below all come from it. Missing is fine - CI sets its variables
// itself and has no .env.
DotNetEnv.Env.TraversePath().Load();

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
// carries none so that `yarn accounts:start` and Playwright's webServer run the same
// command in the same environment. The name is what Sentry's `environment` is
// built from.
var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    EnvironmentName = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? Environments.Development,
});

builder.WebHost.UseUrls($"http://localhost:{Environment.GetEnvironmentVariable("PORT") ?? "3001"}");

// The API's own Sentry, and the middle of a trace that starts in a browser and
// ends in the notifications service.
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
// The options themselves are in ../Observability/SentrySetup.cs, because the
// notifications service wants the same ones and a rule that lives in two files
// is a rule that will disagree with itself. What stays here is the part that is
// this service's own: its name, and which variable holds its DSN.
//
// A DIFFERENT SENTRY PROJECT from the browser's, `alexisregnaud/frontend-demo-api`.
// A trace is linked by its id, not by its project, so all three parts still
// read as one trace - while a .NET stack and a React stack stay in separate
// issue streams, and the source-map upload in ../../vite.config.ts stays a
// frontend-only concern.
builder.AddDemoObservability("account-api", Environment.GetEnvironmentVariable("SENTRY_DSN"));

builder.Services.AddDbContext<AccountsDb>(options => options.UseNpgsql(AccountsDb.ConnectionString()));

// The line that makes the second service visible in a trace, and it is easy to
// miss because it looks like plumbing.
//
// `AddHttpClient` turns on the HTTP client FACTORY, and Sentry.AspNetCore
// registers a message handler filter on it: every client the factory builds
// gets a handler that attaches `sentry-trace` and `baggage` to outgoing
// requests and opens an `http.client` span for each one. The typed overload
// gives NotificationsClient its own configured client through that same
// factory. Take this away and the account API still calls the notifications
// service, and Sentry shows two unrelated traces instead of one.
//
// The timeout is short on purpose: a save waits for this call (see
// NotificationsClient.cs), so a notifications service that hangs would
// otherwise hold the visitor's PUT open for the client's 100-second default.
builder.Services.AddHttpClient<NotificationsClient>(client =>
{
    client.BaseAddress = NotificationsClient.BaseAddress;
    client.Timeout = TimeSpan.FromSeconds(5);
});

// EF Core prints every statement it runs at Information, which with no
// appsettings.json to say otherwise is the level this host logs at. The SQL
// is worth having, and it is already where it is worth having: on the
// `db.query` span Sentry attaches to the request. The terminal `yarn start`
// shares with Vite is not that place.
//
// The other filter this host used to carry - the one keeping the framework's
// running commentary out of Sentry - is in ../Observability/SentrySetup.cs now,
// with the rest of what both services say.
builder.Logging.AddFilter("Microsoft.EntityFrameworkCore", LogLevel.Warning);

var app = builder.Build();

// Bring the database up to date, then make sure `yarn dev` has something to
// show. Listening only starts after this, which is what lets Playwright's
// webServer read "answers /health" as "the database answered and the
// migrations ran".
using (var startup = app.Services.CreateScope())
{
    var db = startup.ServiceProvider.GetRequiredService<AccountsDb>();
    await db.Database.MigrateAsync();
    if (await Store.FindAccount(db, Session.Demo) is null)
    {
        await Store.SaveAccount(db, Session.Demo, demoAccount);
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
//
// No notification: seeding is a spec arranging its GIVEN, not somebody editing
// their details, and a notification for it would be one the spec then has to
// subtract before it can assert on the save it actually made.
app.MapPut("/__test__/account", async (HttpRequest request, Account account, AccountsDb db) =>
    Results.Json(await Store.SaveAccount(db, Session.Read(request), account), statusCode: StatusCodes.Status201Created));

app.MapGet("/api/account", async (HttpRequest request, AccountsDb db) =>
    await Store.FindAccount(db, Session.Read(request)) is { } account ? Results.Json(account) : NoAccount());

app.MapPut("/api/account", async (
    HttpRequest request,
    AccountPayload payload,
    AccountsDb db,
    NotificationsClient notifications,
    ILogger<Program> logger) =>
{
    var session = Session.Read(request);
    if (await Store.UpdateAccount(db, session, payload) is not { } updated)
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
    // The second service, called after the save and before the response.
    // Awaited, and unable to fail this endpoint - NotificationsClient.cs is
    // where both of those decisions are argued.
    await notifications.AccountChanged(session, updated);
    return Results.Json(updated);
});

// A method these routes do not take is a 405, and a path none of them match a
// 404, both from the router and both with an empty body. The Node version wrote
// `{ error }` into those; nothing on the other end ever read it (see
// src/account/helpers/api.ts, which looks at `response.ok` and nothing else).

app.Run();

static IResult NoAccount() =>
    Results.Json(new { error = "No account for this session" }, statusCode: StatusCodes.Status404NotFound);
