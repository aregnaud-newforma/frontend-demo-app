/**
 * UNIT TEST - ../validation: accountSchema.
 *
 * One `it` per input class: every rejection reason and every boundary the
 * schema distinguishes. `valid` is a fully valid account; each test overrides
 * only the field its case turns on.
 */
import { describe, expect, it } from "vitest";
import { accountSchema } from "../validation";
import type { AccountValues } from "../validation";

const valid: AccountValues = {
  nom: "Lovelace",
  prenom: "Ada",
  email: "ada@example.com",
  telephone: "0612345678",
  langue: "fr",
  bio: "Mathematician",
};

describe("accountSchema", () => {
  it.each(["", "   "])("rejects the nom %j as required", (nom) => {
    // Arrange: a fully valid account, with the nom this row turns on
    const input: AccountValues = { ...valid, nom };
    // Act
    const result = accountSchema.safeParse(input);
    // Assert
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Name is required");
  });

  it("rejects an empty prenom", () => {
    // Arrange
    const input: AccountValues = { ...valid, prenom: "" };
    // Act
    const result = accountSchema.safeParse(input);
    // Assert
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("First name is required");
  });

  it("rejects an empty email", () => {
    // Arrange
    const input: AccountValues = { ...valid, email: "" };
    // Act
    const result = accountSchema.safeParse(input);
    // Assert
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Email is required");
  });

  it.each(["ada.example.com", "ada@"])("rejects the malformed email %j", (email) => {
    // Arrange: a fully valid account, with the email this row turns on
    const input: AccountValues = { ...valid, email };
    // Act
    const result = accountSchema.safeParse(input);
    // Assert
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Email is invalid");
  });

  it.each(["06 12 34 AB 78", "06 12 34 56"])("rejects the telephone %j", (telephone) => {
    // Arrange: a fully valid account, with the telephone this row turns on
    const input: AccountValues = { ...valid, telephone };
    // Act
    const result = accountSchema.safeParse(input);
    // Assert
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Phone number is invalid");
  });

  it("rejects the placeholder langue", () => {
    // Arrange
    const input: AccountValues = { ...valid, langue: "" };
    // Act
    const result = accountSchema.safeParse(input);
    // Assert
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Language is required");
  });

  it("rejects a bio of 201 characters", () => {
    // Arrange
    const input: AccountValues = { ...valid, bio: "a".repeat(201) };
    // Act
    const result = accountSchema.safeParse(input);
    // Assert
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Bio must be 200 characters or less");
  });

  it("accepts a bio of exactly 200 characters", () => {
    // Arrange
    const input: AccountValues = { ...valid, bio: "a".repeat(200) };
    // Act
    const result = accountSchema.safeParse(input);
    // Assert
    expect(result.success).toBe(true);
  });

  it("accepts an empty telephone", () => {
    // Arrange
    const input: AccountValues = { ...valid, telephone: "" };
    // Act
    const result = accountSchema.safeParse(input);
    // Assert
    expect(result.success).toBe(true);
  });

  it("accepts an empty bio", () => {
    // Arrange
    const input: AccountValues = { ...valid, bio: "" };
    // Act
    const result = accountSchema.safeParse(input);
    // Assert
    expect(result.success).toBe(true);
  });
});
