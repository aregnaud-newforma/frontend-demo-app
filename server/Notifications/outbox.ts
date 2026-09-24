import type { Notification } from "./messages.ts";

/**
 * Everything this service has "sent", kept in memory and keyed by session.
 *
 * IN MEMORY ON PURPOSE. The account service carries a database because the
 * account has to survive a restart - that is what docs/adr/0001 is about. A
 * notification does not: once it is out, the thing that remembers it is the
 * recipient's inbox. Giving this service its own Postgres would double the
 * migration surface, the compose file and the CI service block to demonstrate
 * nothing the account service does not already demonstrate. A real one would
 * have a queue in front of it rather than a table behind it.
 *
 * Keyed by session for the reason the accounts table is (see
 * ../Accounts/Program.cs, PER-TEST ISOLATION): Playwright runs specs in
 * parallel against one process, and a spec reading /__test__/notifications must
 * see its own and no one else's. The account service forwards the session it
 * read, so the isolation survives the hop.
 *
 * A plain `Map` and a plain array, where the C# this replaced needed a
 * `ConcurrentDictionary` and a `lock` around every list: ASP.NET Core serves
 * requests on whatever thread it has, and Node serves them all on one. The
 * concurrency this class used to defend against cannot happen here, so the
 * defence is gone rather than transliterated.
 */
export class Outbox {
  readonly #sent = new Map<string, Notification[]>();

  record(session: string, notification: Notification): void {
    const forSession = this.#sent.get(session);
    if (forSession === undefined) {
      this.#sent.set(session, [notification]);
      return;
    }
    forSession.push(notification);
  }

  /** In the order they were sent. Empty for a session that got none. */
  for(session: string): readonly Notification[] {
    return this.#sent.get(session) ?? [];
  }
}
