/**
 * What a task is and how its answer is scored — the half of the suite that
 * knows nothing about this repository.
 *
 * The rules under test, the prompts that tempt an agent to break them and the
 * families they are counted under are all repository content and live in
 * `evals.config.ts`. This file only says what such a task has to look like, so
 * the machinery around it can be lifted somewhere else unchanged.
 */
import { z } from "zod";

/** What the rule says a correct answer looks like. */
export const EXPECTATIONS = ["none", "some"] as const;

export type Expectation = (typeof EXPECTATIONS)[number];

/**
 * How a task's answer is scored.
 *
 * `diff` counts calls the agent added and is the cheaper, harder-to-argue-with
 * grader: prefer it whenever a rule has an API signature. `judge` exists for the
 * rules that do not — where the same code can be right or wrong depending on why
 * it was written, and the reason is in the agent's summary rather than the diff.
 *
 * Both write the one score `RULE_GATE`, so a judged task is a line on the same
 * chart as a counted one and neither is privileged — and so every run, whatever
 * its gate, has the same columns in Langfuse. The `family` is metadata: it goes
 * on the dataset item and in front of the score's comment, where it groups
 * tasks without becoming a column of its own. Scores used to be named after it,
 * and a project with five gates already showed eleven mostly empty columns;
 * fifteen families would have made the list unreadable. A task whose grader is
 * converted from one kind to the other keeps the family it had, so the
 * grouping survives the conversion.
 */
export type Grader =
  | {
      readonly kind: "diff";
      /** The rule group this task belongs to, for the item's metadata and the score's comment. */
      readonly family: string;
      readonly expect: Expectation;
      /**
       * The call this family is recognised by, as a regular expression source.
       * A string and not a `RegExp` because it travels to Langfuse inside the
       * item's `expectedOutput` and is read back from there, and JSON has no
       * regexes.
       *
       * The call only: `gradeAdded` anchors it to the lines a diff *adds*, so a
       * task cannot fail for a call the file already had and no task has to
       * remember to write that anchor. It lives on the task because a rule
       * family is repository content — a fixed list of families here would be
       * this repository's rules wearing the harness's clothes.
       */
      readonly added: string;
    }
  | {
      readonly kind: "judge";
      /** The rule group this task belongs to, as on a diff grader. */
      readonly family: string;
      /**
       * The question, in prose, that the judge answers about the diff and the
       * agent's summary. It lives beside the task rather than in a Langfuse form
       * because a criterion is the definition of the score: it has to be
       * reviewable in a pull request and changeable in the same commit as the
       * rule it measures.
       */
      readonly criterion: string;
    };

/**
 * Whether the trial lets the agent run the project's own checks before it
 * finishes, as that project's `AGENTS.md` asks of every agent working in it.
 */
export type ChecksPolicy = "run" | "skip";

export type EvalTask = {
  /**
   * The rule file under `.claude/skills/<gate>/references/` the prompt tempts an
   * agent to break, minus the extension — so the dataset item id names what is
   * being gated. A positive control has no rule to point at and says so.
   */
  readonly id: string;
  /**
   * The skill whose rules this task gates, spelled exactly as its directory
   * under `.claude/skills/`, and so also the Langfuse dataset the task lands in.
   * The directory name is what lets CI run only the gates whose rules a pull
   * request actually touched: a rule-family name like "effects" matches no path,
   * a skill name matches `.claude/skills/react/**`.
   *
   * Coarser than the rule: a `react` run averages effects and re-render alike.
   * Nothing diagnostic is lost, because the per-task score is named after the
   * grader's family, not after the gate, and `effects_gate` stays its own line.
   */
  readonly gate: string;
  /** How the answer is scored, and what a correct one looks like. */
  readonly grader: Grader;
  /**
   * Handed to the agent verbatim, one trial per entry. Never names a rule, a
   * hook or a skill. Several entries are one need in several voices — precise,
   * casual, an edge case — so a rule that survives only the phrasing it was
   * written against shows as a lower score rather than a pass. `--repeat` runs
   * every entry that many times, and the per-task score averages them all.
   */
  readonly prompts: readonly [string, ...string[]];
  /** The rule the prompt tests, stated as a rule. Read by humans in Langfuse. */
  readonly rationale: string;
  /**
   * "skip" roughly halves a trial: the checks are most of the turns. Nothing a
   * type-checker or a test suite runs can catch a misplaced effect — that
   * absence is why this suite exists — so for such a task they are cost without
   * signal. A task whose rule a check *could* catch must say "run".
   */
  readonly checks: ChecksPolicy;
};

/**
 * The grader as it travels to Langfuse and back: `run.ts` reads one off a
 * dataset item it did not write in this process — an item a previous run stored,
 * possibly under an older shape — and that is untrusted input, not a literal
 * `tsc` has already checked. A schema says what is acceptable once; the
 * hand-rolled field-by-field check it replaced said it a second time, and only
 * one of the two was ever going to be updated.
 */
export const graderSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("diff"),
    family: z.string(),
    expect: z.enum(EXPECTATIONS),
    added: z.string(),
  }),
  z.object({ kind: z.literal("judge"), family: z.string(), criterion: z.string() }),
]) satisfies z.ZodType<Grader>;

/**
 * The gates that actually carry a task, which is all CI can run: a gate with no
 * task would spawn a job with nothing to score.
 */
export const gatesWithTasks = (tasks: readonly EvalTask[]): readonly string[] => [
  ...new Set(tasks.map((task) => task.gate)),
];

export type Grade = {
  readonly passed: boolean;
  readonly addedCount: number;
  readonly comment: string;
};

/**
 * The one score every task writes. One name so that Langfuse's own mean of it
 * over a run's items is the run's pass rate, in the same column for every gate;
 * the family that used to name it is in the comment and the item metadata.
 */
export const RULE_GATE = "rule_gate";

/**
 * Anchors a family's call pattern to the lines the diff *adds*, so a task that
 * touches a component with a pre-existing legitimate call cannot fail for
 * someone else's code. Non-capturing, so a pattern that is itself an
 * alternation still binds to the `+` and not to its first branch.
 */
export const addedCall = (grader: Extract<Grader, { kind: "diff" }>): RegExp =>
  new RegExp(String.raw`^\+.*(?:${grader.added})`, "gm");

export const gradeAdded = (diff: string, grader: Extract<Grader, { kind: "diff" }>): Grade => {
  if (diff.trim() === "") {
    return { passed: false, addedCount: 0, comment: "no source change" };
  }

  const addedCount = [...diff.matchAll(addedCall(grader))].length;
  const passed = grader.expect === "none" ? addedCount === 0 : addedCount > 0;

  return {
    passed,
    addedCount,
    comment: `expected ${grader.expect}, added ${addedCount} ${grader.family} call(s)`,
  };
};
