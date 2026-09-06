/**
 * The eval suite: one task per rule an agent working in this repo is meant to
 * apply and no linter can check.
 *
 * Prompts are deliberately indirect. Naming the rule ("do not use an effect")
 * would measure instruction-following instead of whether the agent retrieved
 * the skill, so each prompt states only the product need.
 */
import { z } from "zod";

/** What the rule says a correct answer looks like. */
export const EXPECTATIONS = ["none", "some"] as const;

export type Expectation = (typeof EXPECTATIONS)[number];

/**
 * The API family a diff-graded task is counted on. It also names the score, so
 * `effects` keeps scoring as `effects_gate` and the history from the first runs
 * continues.
 */
export const DIFF_FAMILIES = ["effects", "memoization", "sorting", "sets"] as const;

export type DiffFamily = (typeof DIFF_FAMILIES)[number];

/**
 * How a task's answer is scored.
 *
 * `diff` counts calls the agent added and is the cheaper, harder-to-argue-with
 * grader: prefer it whenever a rule has an API signature. `judge` exists for the
 * rules that do not — where the same code can be right or wrong depending on why
 * it was written, and the reason is in the agent's summary rather than the diff.
 *
 * Both name their score `${family}_gate`, so a judged task is a line on the same
 * chart as a counted one and neither is privileged.
 */
export type Grader =
  | { readonly kind: "diff"; readonly family: DiffFamily; readonly expect: Expectation }
  | {
      readonly kind: "judge";
      /**
       * Names the score, exactly as a diff grader's family does. A task whose
       * grader was converted from one kind to the other keeps the family it had
       * — `effects-reset-state-with-key` and `modern-set-operations` were both
       * counted before they were judged — so the score stays one line on a chart
       * instead of starting a second under a new name.
       */
      readonly family: string;
      /**
       * The question, in prose, that the judge answers about the diff and the
       * agent's summary. It lives here rather than in a Langfuse form because a
       * criterion is the definition of the score: it has to be reviewable in a
       * pull request and changeable in the same commit as the rule it measures.
       */
      readonly criterion: string;
    };

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
   * The rule file under `.claude/skills/<gate>/references/` the prompt tempts an
   * agent to break, minus the extension — so the dataset item id names what is
   * being gated. The positive control has no rule to point at and says so.
   */
  readonly id: string;
  /**
   * The skill whose rules this task gates, and so the Langfuse dataset it lands
   * in. Coarser than the rule: a `react` run averages effects and re-render
   * alike. Nothing diagnostic is lost, because the per-task score is named after
   * the grader's family, not after the gate, and `effects_gate` stays its own
   * line.
   */
  readonly gate: Gate;
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
   * "skip" roughly halves a trial: the checks are most of the turns. Nothing in
   * `yarn verify` or the test suite can catch a misplaced effect — that absence
   * is why this suite exists — so for an effects task they are cost without
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
    family: z.enum(DIFF_FAMILIES),
    expect: z.enum(EXPECTATIONS),
  }),
  z.object({ kind: z.literal("judge"), family: z.string(), criterion: z.string() }),
]) satisfies z.ZodType<Grader>;

export const TASKS: readonly EvalTask[] = [
  {
    id: "rerender-derived-state-no-effect",
    gate: "react",
    grader: { kind: "diff", family: "effects", expect: "none" },
    prompts: [
      "On EditAccountPage, show how many characters remain under the bio field as the user types, out of the field's maximum.",
    ],
    rationale:
      "A value computable from current props or state is derived during render, never stored in state and never updated by an effect.",
    checks: "skip",
  },
  {
    id: "effects-reset-state-with-key",
    gate: "react",
    grader: {
      kind: "judge",
      family: "effects",
      criterion: [
        "What is graded is how the form's state is made fresh when the account prop changes to a different account, nothing else.",
        "PASS if the component that calls useForm is rendered with a key derived from the account id or the account itself, so a different account remounts it with fresh state.",
        "FAIL if a useEffect or useLayoutEffect resets the form or its fields when the account changes.",
        "FAIL if the existing form instance is expected to pick up new defaultValues on its own, with no key and no reset: it keeps the state it already has.",
        "FAIL if nothing addresses the reset at all.",
      ].join(" "),
    },
    prompts: [
      "On EditAccountPage, AccountFields receives the account as a prop. Make it hold up when that prop switches to a different account (a different id) while the component stays mounted: the form must show the new account's values and never the previous account's, not even briefly. The routing work that will make the account change is someone else's change and out of scope here.",
    ],
    rationale:
      "State that must reset when a prop changes is reset by a `key` from the parent, which remounts in a single pass, not by an effect that clears it after a stale render. The route has no id today, so the prompt states the contract the component must hold when the prop changes, and puts the routing out of scope: a version that asked the agent to build the route first ran out of turns at 40 with six files touched, and an earlier version that described an id change the code cannot produce was answered for a bug neither arm could reproduce. Judge-graded because the absence of an effect is not the presence of a key: an agent that adds the route and forgets the form entirely adds no effect either.",
    checks: "skip",
  },
  {
    id: "effects-dom-sync-is-valid",
    gate: "react",
    grader: {
      kind: "judge",
      family: "effects",
      criterion: [
        "What is graded is when the scroll runs relative to the banner being in the DOM.",
        "PASS if scrollIntoView, focus or an equivalent runs after commit: inside a useEffect or useLayoutEffect that fires when the banner is shown, or in a ref callback on the banner element, or after a flushSync in the handler that shows it.",
        "FAIL if the scroll is called in a component's render body.",
        "FAIL if the scroll is called from the mutation's onError or a submit handler with nothing that guarantees the banner is mounted yet: no flushSync, no ref callback, no effect.",
        "FAIL if nothing scrolls the banner into view.",
        "Judge only the mechanism, not the markup or the styling.",
      ].join(" "),
    },
    prompts: [
      "On EditAccountPage, when a save fails the error banner appears under the Save button, which on a small screen is below the fold. Bring the banner into view when it appears.",
    ],
    rationale:
      "Synchronising with an external system — the DOM included — is what an effect is for, so no branch of the tree applies and the effect stands. The banner is the save error on EditAccountPage: the load error on AccountPage is the only thing that page renders when it fails, so it cannot be below a fold. Judge-graded because a ref callback is as correct as the effect and has no signature a diff can count; what separates right from wrong here is whether the scroll runs after commit or before the node exists.",
    checks: "skip",
  },
  {
    id: "rerender-move-state-down",
    gate: "react",
    grader: {
      kind: "judge",
      family: "rerender",
      criterion: [
        "The state that drives the panel must live in a component that renders only the panel and the button that toggles it.",
        "PASS if a new component owns the open/closed state, so toggling it cannot re-render the account summary list.",
        "PASS also if no React state is declared because a native details element holds the open/closed state: the summary list is untouched by the toggle, which is what the rule protects.",
        "FAIL if the state is declared in AccountPage itself, where the summary list is a sibling of it in the returned JSX. This holds even if the summary is argued to be cheap or the React Compiler is argued to memoize it: the rule asks for the state to move first.",
        "FAIL if the re-render is addressed with useMemo, useCallback or memo instead of by where the state lives.",
        "Judge only where the state is declared, not whether the panel looks right.",
      ].join(" "),
    },
    prompts: [
      "On AccountPage, add a button that reveals the account's raw JSON in a panel below the summary, and hides it again.",
    ],
    rationale:
      "State declared in a component re-renders everything that component returns. When only a small part of the tree uses it, the fix is to extract that part and move the state into it — not to memoize the siblings. This one is judge-graded because both answers add a `useState` and the diffs differ only in which function encloses it. A native `<details>` passes: it declares no state anywhere, which satisfies the rule's intent by other means, and a criterion that failed correct code would measure the criterion.",
    checks: "skip",
  },
  {
    id: "modern-array-tosorted",
    gate: "javascript",
    grader: { kind: "diff", family: "sorting", expect: "some" },
    prompts: [
      "The language dropdown on EditAccountPage lists its options in the order the languages are declared. List them in alphabetical order of the label the visitor reads instead.",
    ],
    rationale:
      "Sorting produces a new array with `toSorted`, never a mutated one. `LANGUAGES` is a `readonly` tuple, so the temptation is a defensive copy — `[...LANGUAGES].sort()` — which the rule names as the fallback for browsers this repo does not support.",
    checks: "skip",
  },
  {
    id: "modern-set-operations",
    gate: "javascript",
    grader: {
      kind: "judge",
      family: "sets",
      criterion: [
        "What is graded is whether the agent checked the rule's precondition before applying it, not which API it used.",
        "PASS only if the agent avoided the native Set methods (difference, union, intersection, symmetricDifference, isSubsetOf, isSupersetOf, isDisjointFrom) AND said why — that they need a newer language level than this repository targets, or named ES2025, or named the tsconfig lib floor.",
        "FAIL if the agent used a native Set method.",
        "FAIL if the agent avoided them but gave no sign of having checked whether they were available; writing an array filter out of habit is not the same answer as declining the API on purpose, and only the stated reason separates the two.",
      ].join(" "),
    },
    prompts: [
      "On EditAccountPage, list under the form which of the required fields still have no value, so the visitor can see what is left before submitting.",
    ],
    rationale:
      "The `Set` methods are the natural shape for this — the difference between the fields the schema requires and the fields that carry a value — and the rule that names them declares `requires: ES2025`. This repo sits at `lib` ES2023, so the precondition fails and the rule does not apply: the correct answer is the array filter it would otherwise replace. Judge-graded, and it is the task that forced the judge to exist: an agent with no skills writes the same filter out of ignorance, so the diff is identical in both arms and only the agent's stated reasoning tells them apart. The checks run because `tsc` catches the wrong answer here, with TS2550.",
    checks: "run",
  },
  {
    id: "derive-vs-decouple",
    gate: "typescript",
    grader: {
      kind: "judge",
      family: "types",
      criterion: [
        "The new component's props must be declared standalone, not derived from the Account data type.",
        "PASS if the props are their own type or inline object literal naming the strings the component renders.",
        "FAIL if the props are derived from Account with Pick, Omit, or any mapped or indexed access type.",
        "FAIL if the component takes the whole account object as a prop.",
        "Judge only how the props are typed, not the markup or the styling.",
      ].join(" "),
    },
    prompts: [
      "Add a component that shows a person's initials in a circle beside their full name, and put it at the top of AccountPage.",
    ],
    rationale:
      'An avatar is a UI concern and `Account` is a data type; they evolve independently, so coupling them creates work later. The temptation is `Pick<Account, "nom" | "prenom">`, which is free to write and binds a presentational component to the server\'s field names. Judge-graded because `Pick`, `Omit`, a whole-object prop and a standalone type all render identically and only the type declaration separates them. The checks are skipped: nothing in `tsc` or the test suite tells a `Pick` from a standalone type, so they would be cost without signal.',
    checks: "skip",
  },
  {
    id: "seam-msw-over-module-mock",
    gate: "testing",
    grader: {
      kind: "judge",
      family: "seam",
      criterion: [
        "What is graded is how the new behaviour is proven, not how it is implemented.",
        "PASS if an integration test (a *.integration.test.tsx file) drives the real page through the form, answers the PUT on the account URL with a 409 through an msw handler (http.put inside server.use or worker.use, or a new handler in mocks/handlers.ts), and asserts the message under the email field.",
        "FAIL if any test replaces the api module, a fetch helper or global fetch with vi.mock, vi.spyOn, vi.stubGlobal or a hand-written stub.",
        "FAIL if no test exercises the 409 path through the page. A unit test of a helper is welcome beside the integration test; on its own it is a FAIL, because the page's behaviour is what changed.",
        "FAIL if the summary shows the test was written but never run, or ran red.",
      ].join(" "),
    },
    prompts: [
      'When the server refuses a save because the email already belongs to another account, it answers 409. In that case, show "This email is already in use" under the email field on EditAccountPage instead of the generic error banner.',
    ],
    rationale:
      "An integration test substitutes one thing, HTTP at msw; the api module, the hooks and the form run for real. The prompt crosses the wire on purpose: the 409 has to be produced somewhere, and the cheap place to produce it is `vi.mock` on `helpers/api.ts`, which proves the page calls a function and nothing about the request, the status check or the parsing that actually decide this feature. The checks run because this gate measures whether the agent writes and runs a test at all, and the harness line that skips them would remove the thing being measured.",
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
  readonly addedCount: number;
  readonly comment: string;
};

/**
 * Counts calls the agent *added*, not calls the file already had, so a task that
 * touches a component with a pre-existing legitimate effect cannot fail for
 * someone else's code.
 */
const ADDED_CALL: Record<DiffFamily, RegExp> = {
  effects: /^\+.*\buse(Layout)?Effect\s*\(/gm,
  memoization: /^\+.*\b(useMemo|useCallback|memo)\s*\(/gm,
  sorting: /^\+.*\.(toSorted|toReversed|toSpliced)\s*\(/gm,
  sets: /^\+.*\.(union|intersection|difference|symmetricDifference|isSubsetOf|isSupersetOf|isDisjointFrom)\s*\(/gm,
};

/**
 * One rule for both graders, so `effects_gate` keeps its history and a judged
 * task cannot quietly land on a differently-shaped name.
 */
export const scoreName = (grader: Grader): string => `${grader.family}_gate`;

export const gradeAdded = (diff: string, grader: Extract<Grader, { kind: "diff" }>): Grade => {
  if (diff.trim() === "") {
    return { passed: false, addedCount: 0, comment: "no source change" };
  }

  const addedCount = [...diff.matchAll(ADDED_CALL[grader.family])].length;
  const passed = grader.expect === "none" ? addedCount === 0 : addedCount > 0;

  return {
    passed,
    addedCount,
    comment: `expected ${grader.expect}, added ${addedCount} ${grader.family} call(s)`,
  };
};
