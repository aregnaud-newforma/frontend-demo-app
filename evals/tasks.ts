/**
 * The eval suite: one task per rule an agent working in this repo is meant to
 * apply and no linter can check.
 *
 * Prompts are deliberately indirect. Naming the rule ("do not use an effect")
 * would measure instruction-following instead of whether the agent retrieved
 * the skill, so each prompt states only the product need.
 */

/** What the rule says a correct answer looks like. */
export type Expectation = "none" | "some";

/**
 * The API family a task is graded on. It also names the score, so `effects`
 * keeps scoring as `effects_gate` and the history from the first runs continues.
 */
export type GradedApi = "effects" | "memoization" | "sorting" | "sets";

/**
 * Whether the trial lets the agent finish with `yarn verify && yarn test`, as
 * `AGENTS.md` asks of every agent in this repo.
 */
export type ChecksPolicy = "run" | "skip";

/**
 * The skills a gate can name, spelled exactly as their directory under
 * `.claude/skills/`. A gate is one Langfuse dataset, and naming it after the
 * directory is what lets CI run only the gates whose rules a pull request
 * actually touched: a rule-family name like "effects" matches no path, a skill
 * name matches `.claude/skills/react/**`.
 *
 * `intentional-tests/` is left out on purpose — it is not one of the five skills
 * `AGENTS.md` declares, and nothing here gates it.
 */
export const GATES = ["engineer", "javascript", "react", "testing", "typescript"] as const;

export type Gate = (typeof GATES)[number];

export type EvalTask = {
  /**
   * The rule file under `.claude/skills/react/references/` the prompt tempts an
   * agent to break, minus the extension — so the dataset item id names what is
   * being gated. The positive control has no rule to point at and says so.
   */
  readonly id: string;
  /**
   * The skill whose rules this task gates, and so the Langfuse dataset it lands
   * in. Coarser than the rule: a `react` run averages effects and re-render
   * alike. Nothing diagnostic is lost, because the per-task score is named after
   * `api`, not after the gate, and `effects_gate` stays its own line.
   */
  readonly gate: Gate;
  /** Which API family the grader counts, and therefore which score is written. */
  readonly api: GradedApi;
  /** Handed to `claude -p` verbatim. Never names a rule, a hook or a skill. */
  readonly prompt: string;
  /** The rule the prompt tests, stated as a rule. Read by humans in Langfuse. */
  readonly rationale: string;
  readonly expect: Expectation;
  /**
   * "skip" roughly halves a trial: the checks are most of the turns. Nothing in
   * `yarn verify` or the test suite can catch a misplaced effect — that absence
   * is why this suite exists — so for an effects task they are cost without
   * signal. A task whose rule a check *could* catch must say "run".
   */
  readonly checks: ChecksPolicy;
};

export const TASKS: readonly EvalTask[] = [
  {
    id: "rerender-derived-state-no-effect",
    gate: "react",
    api: "effects",
    prompt:
      "On EditAccountPage, show how many characters remain under the bio field as the user types, out of the field's maximum.",
    rationale:
      "A value computable from current props or state is derived during render, never stored in state and never updated by an effect.",
    expect: "none",
    checks: "skip",
  },
  {
    id: "effects-reset-state-with-key",
    gate: "react",
    api: "effects",
    prompt:
      "EditAccountPage keeps the previous account's field values on screen for a moment when the route's account id changes. Make the form start fresh for the new id.",
    rationale:
      "State that must reset when a prop changes is reset by a `key` from the parent, which remounts in a single pass, not by an effect that clears it after a stale render.",
    expect: "none",
    checks: "skip",
  },
  {
    id: "effects-dom-sync-is-valid",
    gate: "react",
    api: "effects",
    prompt: "When the error banner on AccountPage appears below the fold, bring it into view.",
    rationale:
      "Synchronising with an external system — the DOM included — is what an effect is for, so no branch of the tree applies and the effect stands.",
    expect: "some",
    checks: "skip",
  },
  {
    id: "rerender-memo",
    gate: "react",
    api: "memoization",
    prompt:
      "On AccountPage, add a search box above the account summary that narrows the visible rows to the ones whose label or value matches what has been typed. Typing should feel instant.",
    rationale:
      "The React Compiler runs on every build here, so `useMemo`, `useCallback` and `memo` written by hand are noise on top of what it already does. The prompt tempts all three: a derived filtered list, a change handler passed to a child, and a row component that re-renders on every keystroke.",
    expect: "none",
    checks: "skip",
  },
  {
    id: "modern-array-tosorted",
    gate: "javascript",
    api: "sorting",
    prompt:
      "The language dropdown on EditAccountPage lists its options in the order the languages are declared. List them in alphabetical order of the label the visitor reads instead.",
    rationale:
      "Sorting produces a new array with `toSorted`, never a mutated one. `LANGUAGES` is a `readonly` tuple, so the temptation is a defensive copy — `[...LANGUAGES].sort()` — which the rule names as the fallback for browsers this repo does not support.",
    expect: "some",
    checks: "skip",
  },
  {
    id: "modern-set-operations",
    gate: "javascript",
    api: "sets",
    prompt:
      "On EditAccountPage, list under the form which of the required fields still have no value, so the visitor can see what is left before submitting.",
    rationale:
      "The `Set` methods are the natural shape for this — the difference between the fields the schema requires and the fields that carry a value — and the rule that names them declares `requires: ES2025`. This repo sits at `lib` ES2023, so the precondition fails and the rule does not apply: the correct answer is the array filter it would otherwise replace. What is graded is the precondition mechanism, not the API. The checks run because `tsc` catches the wrong answer here, with TS2550.",
    expect: "none",
    checks: "run",
  },
];

/**
 * The gates that actually carry a task, which is all CI can run: a gate named in
 * `GATES` but empty would spawn a job with nothing to score.
 */
export const gatesWithTasks = (): readonly Gate[] => [...new Set(TASKS.map((task) => task.gate))];

export type Grade = {
  readonly passed: boolean;
  readonly effectCount: number;
  readonly comment: string;
};

/**
 * Counts calls the agent *added*, not calls the file already had, so a task that
 * touches a component with a pre-existing legitimate effect cannot fail for
 * someone else's code.
 */
const ADDED_CALL: Record<GradedApi, RegExp> = {
  effects: /^\+.*\buse(Layout)?Effect\s*\(/gm,
  memoization: /^\+.*\b(useMemo|useCallback|memo)\s*\(/gm,
  sorting: /^\+.*\.(toSorted|toReversed|toSpliced)\s*\(/gm,
  sets: /^\+.*\.(union|intersection|difference|symmetricDifference|isSubsetOf|isSupersetOf|isDisjointFrom)\s*\(/gm,
};

/** `effects` keeps its original score name, so its history is unbroken. */
export const scoreName = (api: GradedApi): string => `${api}_gate`;

export const gradeAdded = (diff: string, api: GradedApi, expect: Expectation): Grade => {
  if (diff.trim() === "") {
    return { passed: false, effectCount: 0, comment: "no source change" };
  }

  const effectCount = [...diff.matchAll(ADDED_CALL[api])].length;
  const passed = expect === "none" ? effectCount === 0 : effectCount > 0;

  return {
    passed,
    effectCount,
    comment: `expected ${expect}, added ${effectCount} ${api} call(s)`,
  };
};
