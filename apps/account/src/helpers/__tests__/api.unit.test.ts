/**
 * UNIT TEST - ../api: toValues, toPayload.
 *
 * The field-for-field copy both directions make is what AccountValues and
 * AccountPayload declare, and the compiler already checks it. What is worth a
 * test is the one thing the two shapes disagree about: the phone, stored
 * E.164 on the wire and shown in national format on the form.
 */
import { describe, expect, it } from "vitest";
import { toPayload, toValues } from "../api";
import type { Account } from "../api";
import type { ValidAccount } from "../validation";

const account: Account = {
  id: "acc_1",
  nom: "Lovelace",
  prenom: "Ada",
  email: "ada@example.com",
  telephone: "+33612345678",
  langue: "fr",
  bio: "Mathematician",
};

const valid: ValidAccount = {
  nom: "Lovelace",
  prenom: "Ada",
  email: "ada@example.com",
  telephone: "0612345678",
  langue: "fr",
  bio: "Mathematician",
};

describe("toValues / toPayload — phone conversion", () => {
  it("converts a stored E.164 phone to national format for the form", () => {
    // Arrange
    const stored: Account = { ...account, telephone: "+33612345678" };
    // Act
    const values = toValues(stored);
    // Assert
    expect(values.telephone).toBe("0612345678");
  });

  it("turns a null stored phone into an empty form value", () => {
    // Arrange
    const stored: Account = { ...account, telephone: null };
    // Act
    const values = toValues(stored);
    // Assert
    expect(values.telephone).toBe("");
  });

  it("turns an unparseable stored phone into an empty form value", () => {
    // Arrange
    const stored: Account = { ...account, telephone: "not-a-number" };
    // Act
    const values = toValues(stored);
    // Assert
    expect(values.telephone).toBe("");
  });

  it("normalizes a national form phone to E.164 for the wire", () => {
    // Arrange
    const submitted: ValidAccount = { ...valid, telephone: "0612345678" };
    // Act
    const payload = toPayload(submitted);
    // Assert
    expect(payload.telephone).toBe("+33612345678");
  });

  it("sends an empty form phone as null", () => {
    // Arrange
    const submitted: ValidAccount = { ...valid, telephone: "" };
    // Act
    const payload = toPayload(submitted);
    // Assert
    expect(payload.telephone).toBeNull();
  });
});
