namespace Api;

/// <summary>
/// Which test's data a request is about.
///
/// <para>
/// PER-TEST ISOLATION. Playwright runs specs in parallel (<c>fullyParallel</c>),
/// and one shared backend would mean one spec's PUT changing what another
/// spec's GET returns. So every row is keyed by a session id, which each test
/// generates and puts in a cookie on its own browser context (see
/// ../../e2e/session.ts). The browser sends it with every request; the server
/// reads it here and sees only that test's data. This is the part a mocked
/// backend never has to solve, and the part real E2E against a shared
/// environment always does.
/// </para>
///
/// <para>
/// Declared in one place because it now crosses a service boundary: the account
/// API reads it off the browser and <see cref="NotificationsClient"/> forwards
/// it, so the notifications service can isolate its outbox by the same key. A
/// second spelling of either name would be a spec that silently reads somebody
/// else's notifications.
/// </para>
/// </summary>
public static class Session
{
    /// <summary>The cookie the browser carries.</summary>
    public const string Cookie = "e2e-session";

    /// <summary>The header the seeding call sends, and the one this API forwards.</summary>
    public const string Header = "x-e2e-session";

    /// <summary>
    /// The session a request belongs to when it names none - which is every
    /// request from a browser someone opened themselves, since only the specs
    /// set the cookie. Without it `yarn dev` has no way to reach any data at
    /// all: the store starts empty and <c>/__test__/account</c> is the only
    /// thing that fills it.
    ///
    /// <para>
    /// Seeded once, the first time the API starts against an empty database,
    /// and mutable like any other session: the form saves, the summary comes
    /// back changed, and the change is still there after a restart.
    /// </para>
    ///
    /// <para>
    /// A spec that forgets <c>startSession</c> lands here rather than on an
    /// error - but it still fails, and at the right place: its assertions name
    /// the random values it seeded, and this record matches none of them.
    /// </para>
    /// </summary>
    public const string Demo = "demo";

    /// <summary>The header first, then the cookie, then the demo.</summary>
    public static string Read(HttpRequest request)
    {
        if (request.Headers.TryGetValue(Header, out var header) && !string.IsNullOrEmpty(header))
        {
            return header.ToString();
        }
        return request.Cookies.TryGetValue(Cookie, out var cookie) ? cookie : Demo;
    }
}
