using System.Collections.Concurrent;

namespace Notifications;

/// <summary>
/// Everything this service has "sent", kept in memory and keyed by session.
///
/// <para>
/// IN MEMORY ON PURPOSE. The account service carries a database because the
/// account has to survive a restart - that is what docs/adr/0001 is about. A
/// notification does not: once it is out, the thing that remembers it is the
/// recipient's inbox. Giving this service its own Postgres would double the
/// migration surface, the compose file and the CI service block to demonstrate
/// nothing the account service does not already demonstrate. A real one would
/// have a queue in front of it rather than a table behind it.
/// </para>
///
/// <para>
/// Keyed by session for the reason the accounts table is (see ../Api/Program.cs,
/// PER-TEST ISOLATION): Playwright runs specs in parallel against one process,
/// and a spec reading /__test__/notifications must see its own and no one
/// else's. The account service forwards the session it read, so the isolation
/// survives the hop.
/// </para>
/// </summary>
public sealed class Outbox
{
    // Concurrent because ASP.NET Core serves requests on whatever thread it
    // has, and this is one object shared by all of them. The lists inside are
    // locked on themselves: List<T> is not thread-safe, and two notifications
    // for one session can land at once.
    private readonly ConcurrentDictionary<string, List<Notification>> sent = new();

    public void Record(string session, Notification notification)
    {
        var forSession = sent.GetOrAdd(session, _ => []);
        lock (forSession)
        {
            forSession.Add(notification);
        }
    }

    /// <summary>In the order they were sent. Empty for a session that got none.</summary>
    public IReadOnlyList<Notification> For(string session)
    {
        if (!sent.TryGetValue(session, out var forSession))
        {
            return [];
        }
        // A copy, taken under the lock: the caller serialises it at its leisure,
        // and another request may be appending while it does.
        lock (forSession)
        {
            return [.. forSession];
        }
    }
}
