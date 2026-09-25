/**
 * Reusable French phone-number parser.
 *
 * This is the piece worth a UNIT test: it is a pure function with real branching
 * (separators, international prefixes, length and prefix rules) and it is reused
 * across the app (form validation, display formatting, API payloads).
 *
 * Accepted inputs (all map to the same number):
 *   "06 12 34 56 78", "06.12.34.56.78", "+33 6 12 34 56 78", "0033612345678"
 * Rejected: empty, non-digit garbage, wrong length, invalid leading prefix.
 */

export type PhoneError = "empty" | "invalid_chars" | "wrong_length" | "invalid_prefix";

export type PhoneParseResult =
  | { valid: true; e164: string; national: string }
  | { valid: false; reason: PhoneError };

// Common separators used in French formatting, including the non-breaking space.
const SEPARATORS = /[\s.\-() ]/g;

/**
 * Normalize any accepted format to a canonical result.
 * `e164` -> "+33612345678", `national` -> "0612345678".
 */
export function parseFrenchPhone(input: string): PhoneParseResult {
  const trimmed = input.trim();
  if (trimmed === "") {
    return { valid: false, reason: "empty" };
  }

  // Strip formatting separators only. Anything else non-digit is a hard error.
  const cleaned = trimmed.replace(SEPARATORS, "");
  if (!/^\+?\d+$/.test(cleaned)) {
    return { valid: false, reason: "invalid_chars" };
  }

  // Collapse the three ways of writing the country code down to a leading 0.
  let national = cleaned;
  if (national.startsWith("+33")) {
    national = "0" + national.slice(3);
  } else if (national.startsWith("0033")) {
    national = "0" + national.slice(4);
  }

  if (national.length !== 10) {
    return { valid: false, reason: "wrong_length" };
  }

  // French numbers are 0 followed by a group digit 1-9 (0 is not a valid group).
  if (national[0] !== "0" || national[1] === "0") {
    return { valid: false, reason: "invalid_prefix" };
  }

  const e164 = "+33" + national.slice(1);
  return { valid: true, e164, national };
}

/** Convenience boolean wrapper for form validation. */
export function isValidFrenchPhone(input: string): boolean {
  return parseFrenchPhone(input).valid;
}
