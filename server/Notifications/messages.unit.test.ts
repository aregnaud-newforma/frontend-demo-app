import { messageFor, type AccountChanged } from "./messages.ts";

/**
 * UNIT TEST - the pure half of the notifications service.
 *
 * What is tested here is what has a right and a wrong answer with no process
 * running: which language a message comes out in, and that the address it is
 * addressed to is the one that was sent. Everything else about this service -
 * that the account API reaches it, that the trace joins across two runtimes,
 * that the outbox isolates by session - needs two processes and is proved in
 * ../../e2e/account.spec.ts.
 *
 * It runs under Vitest's `unit` project rather than xunit, because this service
 * is no longer .NET (docs/adr/0005). `yarn server:test` is now the account
 * API's tests alone.
 */
const change = (langue: string): AccountChanged => ({
  accountId: "demo-account",
  email: "camille.durand@example.com",
  langue,
});

describe("messageFor", () => {
  it("writes in French for a French account", () => {
    const notification = messageFor(change("fr"));

    expect(notification.subject).toBe("Votre compte a été mis à jour");
    expect(notification.body).toContain("modifiées");
  });

  it("writes in English for an English account", () => {
    const notification = messageFor(change("en"));

    expect(notification.subject).toBe("Your account was updated");
    expect(notification.body).toContain("changed");
  });

  // A language neither the form nor the schema can produce still gets a message
  // rather than a throw - messages.ts argues why that is the right answer to a
  // value that should never have been saved.
  it("falls back to English for an unknown language", () => {
    expect(messageFor(change("kl")).subject).toBe("Your account was updated");
  });

  it("addresses the account's email", () => {
    expect(messageFor(change("fr")).to).toBe("camille.durand@example.com");
  });
});
