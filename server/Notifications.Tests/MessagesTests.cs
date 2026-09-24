using Xunit;

namespace Notifications.Tests;

/// <summary>
/// UNIT TEST - the pure half of the notifications service.
///
/// <para>
/// What is tested here is what has a right and a wrong answer with no process
/// running: which language a message comes out in, and that the address it is
/// addressed to is the one that was sent. Everything else about this service -
/// that the account API reaches it, that the trace joins, that the outbox
/// isolates by session - needs two processes and is proved in
/// ../../e2e/account.spec.ts.
/// </para>
/// </summary>
public class MessagesTests
{
    private static AccountChanged Change(string langue) =>
        new(AccountId: "demo-account", Email: "camille.durand@example.com", Langue: langue);

    [Fact]
    public void WritesInFrenchForAFrenchAccount()
    {
        var notification = Messages.For(Change("fr"));

        Assert.Equal("Votre compte a été mis à jour", notification.Subject);
        Assert.Contains("modifiées", notification.Body);
    }

    [Fact]
    public void WritesInEnglishForAnEnglishAccount()
    {
        var notification = Messages.For(Change("en"));

        Assert.Equal("Your account was updated", notification.Subject);
        Assert.Contains("changed", notification.Body);
    }

    /// <summary>
    /// A language neither the form nor the schema can produce still gets a
    /// message rather than an exception - Messages.cs argues why that is the
    /// right answer to a value that should never have been saved.
    /// </summary>
    [Fact]
    public void FallsBackToEnglishForAnUnknownLanguage()
    {
        var notification = Messages.For(Change("kl"));

        Assert.Equal("Your account was updated", notification.Subject);
    }

    [Fact]
    public void AddressesTheAccountsEmail()
    {
        var notification = Messages.For(Change("fr"));

        Assert.Equal("camille.durand@example.com", notification.To);
    }
}
