import { parseOnlineVerdict, parseVerdict } from "./judge.ts";

// The reply that broke the first CI run: valid-looking JSON with a paragraph in
// `reason`, which puts a raw newline inside the string and makes JSON.parse throw.
const PARAGRAPH_REASON = `{"passed": true, "reason": "The handler is declared inside ScrollableMainPanel,
not in RootLayout, so RootLayout does not re-render."}`;

describe("parseVerdict", () => {
  it("reads clean JSON", () => {
    expect(parseVerdict('{"passed": false, "reason": "no key on the list item"}')).toEqual({
      kind: "graded",
      passed: false,
      reason: "no key on the list item",
    });
  });

  it("reads JSON wrapped in a code fence", () => {
    expect(parseVerdict('```json\n{"passed": true, "reason": "ok"}\n```')).toMatchObject({
      kind: "graded",
      passed: true,
      reason: "ok",
    });
  });

  it("reads the verdict out of JSON that a newline in `reason` broke", () => {
    const verdict = parseVerdict(PARAGRAPH_REASON);
    expect(verdict).toMatchObject({ kind: "graded", passed: true });
    expect(verdict.reason).toContain("ScrollableMainPanel");
  });

  it("reads the verdict out of prose around the JSON", () => {
    expect(
      parseVerdict('Here is my verdict:\n{"passed": false, "reason": "x"}\nHope this helps.'),
    ).toMatchObject({ kind: "graded", passed: false });
  });

  it("is unavailable, with the whole reply, when no verdict is there", () => {
    const verdict = parseVerdict("I cannot judge this diff.");
    expect(verdict.kind).toBe("unavailable");
    expect(verdict.reason).toContain("I cannot judge this diff.");
  });
});

describe("parseOnlineVerdict", () => {
  it("is inapplicable when the judge says the criterion does not apply", () => {
    expect(
      parseOnlineVerdict('{"applies": false, "passed": true, "reason": "no effect in the diff"}'),
    ).toEqual({ kind: "inapplicable", reason: "no effect in the diff" });
  });

  it("grades when the criterion applies", () => {
    expect(parseOnlineVerdict('{"applies": true, "passed": false, "reason": "x"}')).toEqual({
      kind: "graded",
      passed: false,
      reason: "x",
    });
  });

  it("reads `applies` and `passed` out of JSON that a newline in `reason` broke", () => {
    const broken = `{"applies": true, "passed": false, "reason": "First line.
Second line."}`;
    expect(parseOnlineVerdict(broken)).toMatchObject({ kind: "graded", passed: false });
    expect(parseOnlineVerdict(broken.replace('"applies": true', '"applies": false'))).toMatchObject(
      {
        kind: "inapplicable",
      },
    );
  });
});
