/**
 * What the account service tells this one happened. THIS SERVICE'S OWN SHAPE,
 * deliberately not the account's.
 *
 * It carries what a notification needs and nothing else: who to write to, and
 * which language to write in. Not the name, not the phone, not the bio - a
 * field the account grows is not a field this service redeploys for.
 *
 * The account service declares the matching shape in its own file
 * (../Accounts/NotificationsClient.cs) and neither side can reach the other's:
 * one is a C# record, one is a TypeScript interface, and there is no build that
 * could share them even if we wanted to. That duplication IS the boundary - a
 * shared type would mean the two services deploy together, which is the one
 * thing splitting them was for. See docs/adr/0004, and docs/adr/0005 for why
 * this half is Node.
 *
 * The casing is the contract's, not this language's: .NET serialises with
 * `JsonSerializerDefaults.Web`, so `AccountId` leaves the account API as
 * `accountId`. These three names are what actually arrives on the wire.
 */
export interface AccountChanged {
  /** Whose account changed, as the account service knows it. */
  accountId: string;
  /** Where the notification goes. */
  email: string;
  /** The account's language, which is the one to write in. */
  langue: string;
}

/**
 * One message, rendered and ready to go out. Kept after it is "sent" so the E2E
 * tier can read it back (see server.ts, /__test__/notifications, and
 * ../../e2e/session.ts, which declares this same shape a third time because it
 * reads it over HTTP like any other client).
 */
export interface Notification {
  to: string;
  subject: string;
  body: string;
}

/**
 * The message for an account that just changed, in the account's language.
 *
 * The rendering, and nothing else: no HTTP, no store, no clock. A pure function
 * of the change, which is what makes it the piece worth a unit test
 * (messages.unit.test.ts) while the wiring around it is left to the E2E tier.
 *
 * English for anything that is not "fr", rather than a throw. The app's Zod
 * schema is what rejects an unknown language before it is ever saved
 * (../../src/account/helpers/validation.ts), so a value arriving here that is
 * neither means the account service let something through - and dropping the
 * notification would be a worse answer to that than sending a readable one.
 */
export function messageFor(change: AccountChanged): Notification {
  return change.langue === "fr"
    ? {
        to: change.email,
        subject: "Votre compte a été mis à jour",
        body:
          "Les informations de votre compte viennent d'être modifiées. " +
          "Si vous n'êtes pas à l'origine de ce changement, contactez-nous.",
      }
    : {
        to: change.email,
        subject: "Your account was updated",
        body: "Your account details have just been changed. If this was not you, get in touch.",
      };
}
