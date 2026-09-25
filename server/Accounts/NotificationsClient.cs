using System.Net.Http.Json;

namespace Accounts;

/// <summary>
/// The notifications service's request body, as THIS service declares it.
///
/// <para>
/// A copy, on purpose. ../Notifications/messages.ts declares the same three
/// fields and neither side can reach the other's: one is a C# record, the other
/// a TypeScript interface, and since docs/adr/0005 there is no build that could
/// share them even if we wanted to. A shared record would be a shared assembly,
/// a shared assembly is a shared version, and a shared version is two services
/// that deploy together - which is the one thing splitting them was for. The
/// duplication IS the contract, and it is small because the contract is (see
/// docs/adr/0004).
/// </para>
///
/// <para>
/// The names cross the wire lowercased - <c>AccountId</c> leaves here as
/// <c>accountId</c> under <c>JsonSerializerDefaults.Web</c> - which is why the
/// TypeScript side spells them that way.
/// </para>
/// </summary>
public sealed record AccountChangedRequest(string AccountId, string Email, string Langue);

/// <summary>
/// How the account API reaches the notifications service.
///
/// <para>
/// A typed client, so the <c>HttpClient</c> comes from the factory - and that
/// is not a style preference here, it is the whole tracing story. Sentry
/// registers a message handler filter on the HTTP client factory, and every
/// client the factory builds gets it: outgoing requests carry
/// <c>sentry-trace</c> and <c>baggage</c>, and each one opens an
/// <c>http.client</c> span under whatever transaction is open. A
/// <c>new HttpClient()</c> here would still work and would show nothing - the
/// notifications service would start a trace of its own, orphaned from the save
/// that caused it. Program.cs registers it; docs/adr/0004 is the long version.
/// </para>
/// </summary>
public sealed class NotificationsClient(HttpClient http, ILogger<NotificationsClient> logger)
{
    /// <summary>
    /// Where the notifications service listens. A variable rather than a
    /// constant because the two processes are two deployments: localhost is
    /// what `yarn start` and Playwright run, and a real one substitutes its own
    /// host the way federation.config.ts does for a remote.
    /// </summary>
    public static Uri BaseAddress =>
        new(Environment.GetEnvironmentVariable("NOTIFICATIONS_URL") ?? "http://localhost:3002");

    /// <summary>
    /// Tells the notifications service an account changed, and never fails
    /// because of it.
    ///
    /// <para>
    /// BEST EFFORT, BY DESIGN. The account is already saved by the time this
    /// runs; a notification that could not be sent is not a reason to tell the
    /// visitor their save did not happen. So every failure is swallowed here
    /// and logged as a warning instead - which is the correct trade and also
    /// the one that makes tracing worth having, because swallowing it is
    /// exactly how a fault becomes invisible in the logs.
    /// </para>
    ///
    /// <para>
    /// It does not become invisible in Sentry. The `http.client` span this call
    /// opens is marked failed and stays inside the `PUT /api/account`
    /// transaction, so the trace shows a save that succeeded with a downstream
    /// call that did not. On a 5xx the SDK also captures an event of its own
    /// (`CaptureFailedRequests` is on by default, for 500-599), and the
    /// notifications service reports the exception into its project - the same
    /// fault, from both sides, on one trace id.
    /// </para>
    ///
    /// <para>
    /// AWAITED rather than fired and forgotten, which is the demo showing its
    /// work: awaiting is what keeps the span inside the transaction and what
    /// lets the E2E tier read the notification back the moment the save
    /// returns. A real system would put a queue here and propagate the trace
    /// through the message headers instead - Sentry's .NET SDK has
    /// `GetTraceHeader()`, `GetBaggage()` and `ContinueTrace()` for precisely
    /// that - at the cost of a save that no longer waits.
    /// </para>
    /// </summary>
    public async Task AccountChanged(string session, Account account)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "/notifications/account-changed")
            {
                Content = JsonContent.Create(
                    new AccountChangedRequest(account.Id, account.Email, account.Langue)),
            };
            // The session travels with the change, so the notifications service
            // can key its outbox the way this one keys its table (see
            // Session.cs). Product data goes in the body; this is isolation,
            // and it stays where the browser put it.
            request.Headers.Add(Session.Header, session);

            var response = await http.SendAsync(request);
            response.EnsureSuccessStatusCode();
        }
        catch (Exception error)
        {
            // Everything, not just HttpRequestException: a timeout arrives as
            // TaskCanceledException, a malformed NOTIFICATIONS_URL as
            // InvalidOperationException, and none of them is worth a failed
            // save. The stack is on the log line, and Sentry has the span.
            logger.LogWarning(error, "Could not notify the notifications service of an account change");
        }
    }
}
