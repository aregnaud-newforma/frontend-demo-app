namespace Notifications;

/// <summary>
/// What the account service tells this one happened. THIS SERVICE'S OWN SHAPE,
/// deliberately not the account's.
///
/// <para>
/// It carries what a notification needs and nothing else: who to write to, and
/// which language to write in. Not the name, not the phone, not the bio - a
/// field the account grows is not a field this service redeploys for, and a
/// field it stops sending is a compile error on the account's side rather than
/// a silent null here.
/// </para>
///
/// <para>
/// The account service declares the matching shape in its own file
/// (../Api/NotificationsClient.cs) and the two projects do not reference each
/// other. That duplication IS the boundary: a shared <c>Account</c> record
/// would mean the two services deploy together, which is the one thing
/// splitting them was for. See docs/adr/0004.
/// </para>
/// </summary>
/// <param name="AccountId">Whose account changed, as the account service knows it.</param>
/// <param name="Email">Where the notification goes.</param>
/// <param name="Langue">The account's language, which is the one to write in.</param>
public sealed record AccountChanged(string AccountId, string Email, string Langue);

/// <summary>
/// One message, rendered and ready to go out. Kept after it is "sent" so the
/// E2E tier can read it back (see Program.cs, /__test__/notifications).
/// </summary>
public sealed record Notification(string To, string Subject, string Body);

/// <summary>
/// The rendering, and nothing else: no HTTP, no store, no clock. A pure
/// function of the change, which is what makes it the piece worth a unit test
/// (../Notifications.Tests/MessagesTests.cs) while the wiring around it is left
/// to the E2E tier.
/// </summary>
public static class Messages
{
    /// <summary>
    /// The message for an account that just changed, in the account's language.
    ///
    /// <para>
    /// English for anything that is not "fr", rather than a throw. The app's
    /// Zod schema is what rejects an unknown language before it is ever saved
    /// (src/account/helpers/validation.ts), so a value arriving here that is
    /// neither means the account service let something through - and dropping
    /// the notification would be a worse answer to that than sending a readable
    /// one.
    /// </para>
    /// </summary>
    public static Notification For(AccountChanged change) =>
        change.Langue == "fr"
            ? new Notification(
                To: change.Email,
                Subject: "Votre compte a été mis à jour",
                Body: "Les informations de votre compte viennent d'être modifiées. "
                    + "Si vous n'êtes pas à l'origine de ce changement, contactez-nous.")
            : new Notification(
                To: change.Email,
                Subject: "Your account was updated",
                Body: "Your account details have just been changed. "
                    + "If this was not you, get in touch.");
}
