/**
 * UNIT TEST - best practices
 * - Test pure logic in isolation: no DOM, no network, no mocks needed.
 * - Cover every BRANCH and boundary, not just the happy value. Here: each
 *   separator style, each international prefix, and each failure reason.
 * - Use table-driven cases (it.each) to make the branch matrix explicit and to
 *   keep one assertion idea per row.
 * - Assert on the exact contract (e164 / national / reason), not internals.
 * - Fast and deterministic: hundreds of these should run in milliseconds.
 * - Given/When/Then like the rest of the suite, but note how little room the
 *   format has here: for a pure function the input IS the Given and calling it
 *   IS the When, so the two are written on one line rather than padded apart.
 *   In the table-driven cases the Given is the table itself - which is the
 *   point of it.each, and why these read as one row per scenario.
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
