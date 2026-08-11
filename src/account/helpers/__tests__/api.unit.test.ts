/**
 * Unit coverage for the account wire mapping.
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

describe("toValues", () => {
  it("returns an object", () => {
    expect(typeof toValues(account)).toBe("object");
  });

  it("copies nom", () => {
    expect(toValues(account).nom).toBe("Lovelace");
  });

  it("copies prenom", () => {
    expect(toValues(account).prenom).toBe("Ada");
  });

  it("copies email", () => {
    expect(toValues(account).email).toBe("ada@example.com");
  });

  it("copies langue", () => {
    expect(toValues(account).langue).toBe("fr");
  });

  it("copies bio", () => {
    expect(toValues(account).bio).toBe("Mathematician");
  });

  it("does not carry the id into the form values", () => {
    expect(toValues(account)).not.toHaveProperty("id");
  });

  it("converts a stored international phone to the national format", () => {
    expect(toValues(account).telephone).toBe("0612345678");
  });

  it("returns an empty phone when the account has none", () => {
    expect(toValues({ ...account, telephone: null }).telephone).toBe("");
  });

  it("returns an empty phone when the stored value cannot be parsed", () => {
    expect(toValues({ ...account, telephone: "not-a-number" }).telephone).toBe("");
  });
});

describe("toPayload", () => {
  it("returns an object", () => {
    expect(typeof toPayload(valid)).toBe("object");
  });

  it("copies nom", () => {
    expect(toPayload(valid).nom).toBe("Lovelace");
  });

  it("copies prenom", () => {
    expect(toPayload(valid).prenom).toBe("Ada");
  });

  it("copies email", () => {
    expect(toPayload(valid).email).toBe("ada@example.com");
  });

  it("copies langue", () => {
    expect(toPayload(valid).langue).toBe("fr");
  });

  it("copies bio", () => {
    expect(toPayload(valid).bio).toBe("Mathematician");
  });

  it("does not add an id to the payload", () => {
    expect(toPayload(valid)).not.toHaveProperty("id");
  });

  it("normalizes a national phone to E.164", () => {
    expect(toPayload(valid).telephone).toBe("+33612345678");
  });

  it("sends null when the phone is left empty", () => {
    expect(toPayload({ ...valid, telephone: "" }).telephone).toBeNull();
  });

  it("round-trips an account through both mappings unchanged", () => {
    const there = toValues(account);
    const back = toPayload(there as ValidAccount);
    expect(back.nom).toBe(account.nom);
    expect(back.prenom).toBe(account.prenom);
    expect(back.email).toBe(account.email);
  });
});
