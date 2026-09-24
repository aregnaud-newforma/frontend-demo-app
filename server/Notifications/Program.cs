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
// WHAT IT IS MADE OF: this file is the HTTP surface only. The message shapes
// and the rendering are in Messages.cs, the store in Outbox.cs, and the Sentry
// setup it shares with the account API in ../Observability/SentrySetup.cs.
//
// WHAT IT DOES NOT HAVE: a database (Outbox.cs says why), a queue, and any
// knowledge of what an account is beyond the three fields Messages.cs declares.
//
// Run it with `yarn notifications:start`. `yarn start` runs it beside the
// account API and the frontend, and Playwright starts it itself (see the
// webServer array in playwright.config.ts), so no one has to remember to.
using Notifications;
using Observability;

// The repo's .env, walked up to from wherever `dotnet run` put the working
// directory - the same file and the same call as ../Accounts/Program.cs, which is
// where the reasoning is. Before anything reads a variable: the DSN and the
// port below both come from it.
DotNetEnv.Env.TraversePath().Load();

// The header the account service forwards, carrying the session it read off the
// browser. Not a cookie: no browser talks to this service, so there is no
// cookie to read and nothing to default to but the demo.
const string SessionHeader = "x-e2e-session";
const string DemoSession = "demo";

// `Development` when nothing says otherwise, for the reason ../Accounts/Program.cs
// gives: ASP.NET Core's own fallback is `Production`, and this project carries
// no launchSettings.json so that the yarn script and Playwright's webServer run
// the same command in the same environment.
var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    EnvironmentName = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? Environments.Development,
});

// 3002, beside the account API's 3001. Its own variable rather than `PORT`,
// because both services read the one .env and would otherwise fight over it.
builder.WebHost.UseUrls($"http://localhost:{Environment.GetEnvironmentVariable("NOTIFICATIONS_PORT") ?? "3002"}");

// Everything this service says to Sentry, on the terms both services share -
// read ../Observability/SentrySetup.cs for what that is. The two arguments are
// the only part that is this service's own.
//
// ITS OWN SENTRY PROJECT, `alexisregnaud/frontend-demo-notifications`, when
// SENTRY_DSN_NOTIFICATIONS is set - so a stack from this service is its team's,
// in its own issue stream, the way a remote's is on the frontend
// (docs/adr/0003). Falling back to the account API's DSN rather than to
// nothing, for the same reason a remote falls back to the shell's: the demo has
// to be worth running with one DSN set, and a service reporting into a
// neighbour's project still shows the split - the `service` tag in the shared
// setup is what tells the two apart there.
//
// Either way the TRACE is one. A trace is linked by its id, not by its project.
builder.AddDemoObservability(
    "notifications",
    Environment.GetEnvironmentVariable("SENTRY_DSN_NOTIFICATIONS")
        ?? Environment.GetEnvironmentVariable("SENTRY_DSN"));

builder.Services.AddSingleton<Outbox>();

var app = builder.Build();

// Playwright's webServer polls this to know the process is up, and the shared
// sampler drops its trace by name.
app.MapGet("/health", () => Results.Json(new { ok = true }));

// The one thing this service is for. Called by the account API, never by a
// browser - there is no proxy in front of it and no CORS to allow, which is
// itself the point: the frontend did not change when the backend became two.
//
// 202 rather than 200: accepted, to be sent. Here the sending is the same
// breath, because the demo has no queue; the status is what it would still be
// once it had one.
app.MapPost(
    "/notifications/account-changed",
    (HttpRequest request, AccountChanged change, Outbox outbox, ILogger<Program> logger) =>
    {
        // A span of this service's own, under the transaction the middleware
        // opened for this request - which is itself under the account API's
        // `http.client` span, which is under the browser's `PUT /api/account`.
        // Four levels, three processes, one trace.
        //
        // Written by hand because there is nothing here to instrument
        // automatically: the account API gets its `db.query` spans free from EF
        // Core, and a service that only renders a string has no library to get
        // them from. `GetSpan()` returns the middleware's transaction, and null
        // when Sentry is off - which is the whole reason for the `?.`.
        var span = SentrySdk.GetSpan()?.StartChild("notification.send", "account changed");
        try
        {
            var notification = Messages.For(change);
            outbox.Record(ReadSession(request), notification);
            // The SHAPE, never the contents - the address is the one field a
            // notification is guaranteed to carry and the one Sentry has no
            // business holding. The same line ../Accounts/Program.cs draws on its
            // own log, and the same one `SendDefaultPii` being off draws for
            // the SDK.
            logger.LogInformation("Notification rendered (langue: {Langue})", change.Langue);
            span?.Finish(SpanStatus.Ok);
        }
        catch (Exception)
        {
            // Marked, then rethrown: the middleware turns it into a 500 and
            // reports it, and the account API sees the failure on its own span
            // in the same trace.
            span?.Finish(SpanStatus.InternalError);
            throw;
        }
        return Results.Accepted();
    });

// Test-only: what this session was sent. Namespaced away from /notifications/
// so it is obvious at the call site that it is not part of the surface the
// account API talks to - the same split ../Accounts/Program.cs makes with
// /__test__/account.
//
// This is what lets the E2E tier PROVE the hop rather than assume it: a save in
// the browser, read back out of a different process than the one that served
// it (e2e/account.spec.ts).
app.MapGet(
    "/__test__/notifications",
    (HttpRequest request, Outbox outbox) => Results.Json(outbox.For(ReadSession(request))));

app.Run();

static string ReadSession(HttpRequest request) =>
    request.Headers.TryGetValue(SessionHeader, out var header) && !string.IsNullOrEmpty(header)
        ? header.ToString()
        : DemoSession;
