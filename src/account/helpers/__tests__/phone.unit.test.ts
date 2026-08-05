/**
 * UNIT TEST - best practices
 * - Test pure logic in isolation.
 */
import { parseFrenchPhone, isValidFrenchPhone } from "../phone";
import { expect, it, describe } from "vitest";

describe("parseFrenchPhone", () => {
  it.each([
    ["national with spaces", "06 12 34 56 78"],
    ["national with dots", "06.12.34.56.78"],
    ["national with dashes", "06-12-34-56-78"],
    ["plain national", "0612345678"],
    ["international +33", "+33 6 12 34 56 78"],
    ["international 0033", "0033612345678"],
  ])("normalizes %s to canonical form", (_label, input) => {
    const result = parseFrenchPhone(input);
    expect(result).toEqual({
      valid: true,
      e164: "+33612345678",
      national: "0612345678",
    });
  });

  it.each([
    ["empty string", "", "empty"],
    ["whitespace only", "   ", "empty"],
    ["letters", "06 12 34 AB 78", "invalid_chars"],
    ["too short", "06 12 34 56", "wrong_length"],
    ["too long", "06 12 34 56 78 90", "wrong_length"],
    ["missing leading zero", "1612345678", "invalid_prefix"],
    ["invalid group digit 0", "0012345678", "invalid_prefix"],
  ])("rejects %s with reason %s", (_label, input, reason) => {
    expect(parseFrenchPhone(input)).toEqual({ valid: false, reason });
  });

  it("accepts a landline (group digit 1)", () => {
    expect(parseFrenchPhone("01 42 68 53 00")).toMatchObject({
      valid: true,
      e164: "+33142685300",
    });
  });
});

describe("isValidFrenchPhone", () => {
  it("is true for a valid number and false otherwise", () => {
    expect(isValidFrenchPhone("+33612345678")).toBe(true);
    expect(isValidFrenchPhone("nope")).toBe(false);
  });
});
