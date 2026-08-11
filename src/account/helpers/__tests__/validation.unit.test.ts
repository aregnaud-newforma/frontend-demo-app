/**
 * Unit coverage for the account schema.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { accountSchema, LANGUAGES, LANGUAGE_LABELS } from "../validation";
import type { AccountValues } from "../validation";

describe("accountSchema", () => {
  let values: AccountValues;

  beforeEach(() => {
    values = {
      nom: "Lovelace",
      prenom: "Ada",
      email: "ada@example.com",
      telephone: "0612345678",
      langue: "fr",
      bio: "",
    };
  });

  describe("shape", () => {
    it("is defined", () => {
      expect(accountSchema).toBeDefined();
    });

    it("exposes a safeParse method", () => {
      expect(typeof accountSchema.safeParse).toBe("function");
    });

    it("returns a result object with a success flag", () => {
      const result = accountSchema.safeParse(values);
      expect(result).toHaveProperty("success");
    });

    it("accepts a fully valid account", () => {
      expect(accountSchema.safeParse(values).success).toBe(true);
    });
  });

  describe("nom", () => {
    it("rejects an empty nom", () => {
      values.nom = "";
      expect(accountSchema.safeParse(values).success).toBe(false);
    });

    it("reports the required message for an empty nom", () => {
      values.nom = "";
      const result = accountSchema.safeParse(values);
      expect(result.error?.issues[0]?.message).toBe("Name is required");
    });

    it("rejects a whitespace-only nom", () => {
      values.nom = "   ";
      expect(accountSchema.safeParse(values).success).toBe(false);
    });
  });

  describe("prenom", () => {
    it("rejects an empty prenom", () => {
      values.prenom = "";
      expect(accountSchema.safeParse(values).success).toBe(false);
    });

    it("reports the required message for an empty prenom", () => {
      values.prenom = "";
      const result = accountSchema.safeParse(values);
      expect(result.error?.issues[0]?.message).toBe("First name is required");
    });
  });

  describe("email", () => {
    it("rejects an empty email", () => {
      values.email = "";
      expect(accountSchema.safeParse(values).success).toBe(false);
    });

    it("reports the required message for an empty email", () => {
      values.email = "";
      const result = accountSchema.safeParse(values);
      expect(result.error?.issues[0]?.message).toBe("Email is required");
    });

    it("rejects an email with no @", () => {
      values.email = "ada.example.com";
      expect(accountSchema.safeParse(values).success).toBe(false);
    });

    it("rejects an email with no domain", () => {
      values.email = "ada@";
      expect(accountSchema.safeParse(values).success).toBe(false);
    });

    it("reports the invalid message for a malformed email", () => {
      values.email = "ada.example.com";
      const result = accountSchema.safeParse(values);
      expect(result.error?.issues[0]?.message).toBe("Email is invalid");
    });

    it("accepts a normal email", () => {
      values.email = "ada@example.com";
      expect(accountSchema.safeParse(values).success).toBe(true);
    });
  });

  describe("telephone", () => {
    it("accepts an empty telephone", () => {
      values.telephone = "";
      expect(accountSchema.safeParse(values).success).toBe(true);
    });

    it("accepts a national telephone", () => {
      values.telephone = "0612345678";
      expect(accountSchema.safeParse(values).success).toBe(true);
    });

    it("accepts an international telephone", () => {
      values.telephone = "+33612345678";
      expect(accountSchema.safeParse(values).success).toBe(true);
    });

    it("rejects a telephone with letters in it", () => {
      values.telephone = "06 12 34 AB 78";
      expect(accountSchema.safeParse(values).success).toBe(false);
    });

    it("rejects a telephone that is too short", () => {
      values.telephone = "0612345";
      expect(accountSchema.safeParse(values).success).toBe(false);
    });
  });

  describe("langue", () => {
    it("accepts fr", () => {
      values.langue = "fr";
      expect(accountSchema.safeParse(values).success).toBe(true);
    });

    it("accepts en", () => {
      values.langue = "en";
      expect(accountSchema.safeParse(values).success).toBe(true);
    });

    it("rejects the empty placeholder option", () => {
      values.langue = "";
      expect(accountSchema.safeParse(values).success).toBe(false);
    });

    it("reports the required message for the placeholder option", () => {
      values.langue = "";
      const result = accountSchema.safeParse(values);
      expect(result.error?.issues[0]?.message).toBe("Language is required");
    });
  });

  describe("bio", () => {
    it("accepts an empty bio", () => {
      values.bio = "";
      expect(accountSchema.safeParse(values).success).toBe(true);
    });

    it("accepts a bio of exactly 200 characters", () => {
      values.bio = "a".repeat(200);
      expect(accountSchema.safeParse(values).success).toBe(true);
    });

    it("rejects a bio of 201 characters", () => {
      values.bio = "a".repeat(201);
      expect(accountSchema.safeParse(values).success).toBe(false);
    });
  });
});

describe("LANGUAGES", () => {
  it("contains fr", () => {
    expect(LANGUAGES).toContain("fr");
  });

  it("contains en", () => {
    expect(LANGUAGES).toContain("en");
  });

  it("holds exactly two languages", () => {
    expect(LANGUAGES).toHaveLength(2);
  });
});

describe("LANGUAGE_LABELS", () => {
  it("labels fr as French", () => {
    expect(LANGUAGE_LABELS.fr).toBe("French");
  });

  it("labels en as English", () => {
    expect(LANGUAGE_LABELS.en).toBe("English");
  });

  it("has a label for every supported language", () => {
    for (const language of LANGUAGES) {
      expect(LANGUAGE_LABELS[language]).toBeTruthy();
    }
  });
});
