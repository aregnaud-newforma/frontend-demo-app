/**
 * The fingerprint CI pays by. `evals.yml` runs no benchmark job when a branch's
 * hash equals the merge base's, so a key that moves it costs ten jobs and a key
 * that does not costs none — and getting that backwards is either a wasted bill
 * or, worse, a skipped run reported as a current pass rate.
 */
import { fingerprintOf, type EvalsConfig } from "./config.ts";

const BASE: EvalsConfig = {
  tasks: [
    {
      id: "rerender-derived-state-no-effect",
      gate: "react",
      grader: { kind: "diff", family: "effects", expect: "none", added: String.raw`\buseEffect\(` },
      prompts: ["Show how many characters remain under the bio field."],
      rationale: "A value computable from props or state is derived during render.",
      checks: "skip",
    },
  ],
  sourcePaths: ["src/**", "server/**"],
};

const hashOf = (overrides: Partial<EvalsConfig>) => fingerprintOf({ ...BASE, ...overrides });

describe("fingerprintOf", () => {
  it("is stable for the same config", () => {
    expect(hashOf({})).toBe(hashOf({}));
  });

  // The reason this file exists: flipping `onlineJudge` on a pull request ran
  // every gate in both arms, and no gate can read the key.
  it("ignores the keys no trial can read", () => {
    expect(hashOf({ onlineJudge: true })).toBe(hashOf({ onlineJudge: false }));
    expect(hashOf({ maxConcurrency: 3 })).toBe(hashOf({}));
  });

  it("ignores the order the keys were written in", () => {
    const reordered: EvalsConfig = { sourcePaths: BASE.sourcePaths, tasks: BASE.tasks };
    expect(fingerprintOf(reordered)).toBe(hashOf({}));
  });

  it("follows what counts as an answer", () => {
    expect(hashOf({ sourcePaths: ["src/**"] })).not.toBe(hashOf({}));
  });

  it("follows a task's prompt, which is the trial itself", () => {
    const reworded = BASE.tasks.map((task) => ({
      ...task,
      prompts: ["Something else entirely."] as const,
    }));
    expect(hashOf({ tasks: reworded })).not.toBe(hashOf({}));
  });

  it("follows who runs and who grades", () => {
    expect(hashOf({ defaultAgent: "claude" })).not.toBe(hashOf({}));
    expect(hashOf({ defaultJudge: "claude" })).not.toBe(hashOf({}));
    expect(hashOf({ agents: { claude: { model: "claude-opus-5" } } })).not.toBe(hashOf({}));
  });

  // A denylist, so a key nobody thought about is hashed rather than dropped: it
  // costs a run nobody needed instead of hiding one that was.
  it("follows a key it has never heard of", () => {
    const invented = { ...BASE, somethingAddedLater: true } as EvalsConfig;
    expect(fingerprintOf(invented)).not.toBe(hashOf({}));
  });
});
