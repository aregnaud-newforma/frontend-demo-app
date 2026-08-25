/**
 * UNIT TEST - ../phone: parseFrenchPhone, isValidFrenchPhone.
 *
 * One `it` per input class the parser distinguishes: one table over the
 * accepted written forms and the canonical pair each reaches, then one test
 * per rejection reason. isValidFrenchPhone agrees with parseFrenchPhone on
 * every one.
 */
import { describe, expect, it } from "vitest";
import { isValidFrenchPhone, parseFrenchPhone } from "../phone";

describe("parseFrenchPhone / isValidFrenchPhone", () => {
  it.each([
    { input: "06 12 34 56 78", e164: "+33612345678", national: "0612345678" },
    { input: "06.12.34.56.78", e164: "+33612345678", national: "0612345678" },
    { input: "06-12-34-56-78", e164: "+33612345678", national: "0612345678" },
    { input: "0612345678", e164: "+33612345678", national: "0612345678" },
    { input: "+33 6 12 34 56 78", e164: "+33612345678", national: "0612345678" },
    { input: "0033612345678", e164: "+33612345678", national: "0612345678" },
    { input: "01 42 68 53 00", e164: "+33142685300", national: "0142685300" },
  ])("parses $input to $e164 / $national", ({ input, e164, national }) => {
    // Arrange: input is the written form this row parses
    // Act
    const result = parseFrenchPhone(input);
    // Assert
    expect(result).toEqual({ valid: true, e164, national });
    expect(isValidFrenchPhone(input)).toBe(true);
  });

  it.each(["", "   "])("rejects %j as empty", (input) => {
    // Arrange: input is the blank form this row rejects
    // Act
    const result = parseFrenchPhone(input);
    // Assert
    expect(result).toEqual({ valid: false, reason: "empty" });
    expect(isValidFrenchPhone(input)).toBe(false);
  });

  it("rejects letters in the number as invalid_chars", () => {
    // Arrange
    const input = "06 12 34 AB 78";
    // Act
    const result = parseFrenchPhone(input);
    // Assert
    expect(result).toEqual({ valid: false, reason: "invalid_chars" });
    expect(isValidFrenchPhone(input)).toBe(false);
  });

  it("rejects a number that is too short as wrong_length", () => {
    // Arrange
    const input = "06 12 34 56";
    // Act
    const result = parseFrenchPhone(input);
    // Assert
    expect(result).toEqual({ valid: false, reason: "wrong_length" });
    expect(isValidFrenchPhone(input)).toBe(false);
  });

  it("rejects a number that is too long as wrong_length", () => {
    // Arrange
    const input = "06 12 34 56 78 90";
    // Act
    const result = parseFrenchPhone(input);
    // Assert
    expect(result).toEqual({ valid: false, reason: "wrong_length" });
    expect(isValidFrenchPhone(input)).toBe(false);
  });

  it("rejects a number missing its leading zero as invalid_prefix", () => {
    // Arrange
    const input = "1612345678";
    // Act
    const result = parseFrenchPhone(input);
    // Assert
    expect(result).toEqual({ valid: false, reason: "invalid_prefix" });
    expect(isValidFrenchPhone(input)).toBe(false);
  });

  it("rejects a number whose group digit is 0 as invalid_prefix", () => {
    // Arrange
    const input = "0012345678";
    // Act
    const result = parseFrenchPhone(input);
    // Assert
    expect(result).toEqual({ valid: false, reason: "invalid_prefix" });
    expect(isValidFrenchPhone(input)).toBe(false);
  });
});
