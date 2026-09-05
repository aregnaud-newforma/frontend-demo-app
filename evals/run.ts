/**
 * Entry point: runs the effects-gate suite and reports it to Langfuse as one
 * dataset run, so the pass rate is a line over time rather than a number in a
 * terminal that scrolls away.
 *
 * Usage: yarn evals [--gate <skill>] [--task <id>] [--arm with-skills|without-skills]
 *                   [--repeat <n>] [--max-concurrency <n>] [--reuse] [--run-name <name>]
 *                   [--max-turns <n>] [--model <id>] [--effort <level>]
 *                   [--judge-model <id>] [--judge-effort <level>] [--list-gates]
 *
 * One gate per invocation: a gate is a Langfuse dataset, and two skills sharing
 * a pass rate would move it for reasons nobody can read.
 */
import { execFile } from "node:child_process";
import { parseArgs, promisify } from "node:util";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseClient } from "@langfuse/client";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import {
  TASKS,
  gatesWithTasks,
  gradeAdded,
  scoreName,
  type EvalTask,
  type Grader,
} from "./tasks.ts";
import {
  cachedTaskIds,
  runTrial,
  DEFAULT_EFFORT,
  DEFAULT_MODEL,
  EFFORTS,
  type Arm,
  type Effort,
  type TrialOutcome,
} from "./trial.ts";
import { judge, JUDGE_EFFORT, JUDGE_MODEL } from "./judge.ts";

const run = promisify(execFile);

const DEFAULT_GATE = "react";

const { values } = parseArgs({
  options: {
    gate: { type: "string" },
    task: { type: "string" },
    arm: { type: "string", default: "with-skills" },
    repeat: { type: "string", default: "2" },
    "max-concurrency": { type: "string", default: "1" },
    reuse: { type: "boolean", default: false },
    "run-name": { type: "string" },
    "max-turns": { type: "string", default: "25" },
    model: { type: "string", default: DEFAULT_MODEL },
    effort: { type: "string", default: DEFAULT_EFFORT },
    "judge-model": { type: "string", default: JUDGE_MODEL },
    "judge-effort": { type: "string", default: JUDGE_EFFORT },
    "list-gates": { type: "boolean", default: false },
  },
});

// Printed for CI, which builds its job matrix from it. Reading the gates from
// here rather than listing them again in the workflow keeps `tasks.ts` the one
// place a gate is declared — the failure `alias.ts` and tsconfig `paths` warn
// about, where half a declaration is wired and the other half rots.
if (values["list-gates"]) {
  console.log(JSON.stringify(gatesWithTasks()));
  process.exit(0);
}

const requested = values.task ? TASKS.find((task) => task.id === values.task) : undefined;
if (values.task && !requested) {
  console.error(`No task named "${values.task}". Known: ${TASKS.map((t) => t.id).join(", ")}`);
  process.exit(1);
}

// A named task settles the gate on its own; asking for both is a way to get a
// run that silently scores nothing.
const gateName = requested?.gate ?? values.gate ?? DEFAULT_GATE;
const gateTasks = TASKS.filter((task) => task.gate === gateName);
if (gateTasks.length === 0) {
  const known = [...new Set(TASKS.map((task) => task.gate))].join(", ");
  console.error(`No gate named "${gateName}". Known: ${known}`);
  process.exit(1);
}

const selected = requested ? [requested] : gateTasks;

/**
 * How many trials each task gets. One is a coin flipped once: the gate score is
 * then 1 or 0, and a gate moving from 5/5 to 4/5 is as easily sampling noise as
 * a skill that regressed. Repeating turns the per-task score into a mean, so the
 * variance shows in the number instead of hiding inside it.
 *
 * Two by default, which is the smallest count that can disagree with itself.
 * Raise it for the tasks whose arms sit within a point of each other — that is
 * the question repetition answers — and lower it to one when the point of the
 * run is to exercise the harness rather than to measure anything.
 */
const repeat = Number(values.repeat);
if (!Number.isInteger(repeat) || repeat < 1) {
  console.error(`--repeat takes a whole number of trials per task, not "${values.repeat}".`);
  process.exit(1);
}

/**
 * How many tasks run at once. One by default, because a trial is minutes and
 * real money and output that interleaves is output nobody reads while it runs.
 * CI reads nothing while it runs and pays by the wall clock, so it raises this:
 * a gate of five tasks at three abreast finishes in two waves instead of five.
 *
 * Tasks, not trials: a task's repetitions stay serial inside it, so the samples
 * a score averages never compete with each other for the same rate limit.
 */
const concurrency = Number(values["max-concurrency"]);
if (!Number.isInteger(concurrency) || concurrency < 1) {
  console.error(
    `--max-concurrency takes a whole number of tasks at once, not "${values["max-concurrency"]}".`,
  );
  process.exit(1);
}

const ARMS: readonly Arm[] = ["with-skills", "without-skills"];
const arm = ARMS.find((candidate) => candidate === values.arm);
if (arm === undefined) {
  console.error(`No arm named "${values.arm}". Known: ${ARMS.join(", ")}`);
  process.exit(1);
}

const effortNamed = (flag: "effort" | "judge-effort"): Effort => {
  const effort = EFFORTS.find((candidate) => candidate === values[flag]);
  if (effort === undefined) {
    console.error(`--${flag} takes one of ${EFFORTS.join(", ")}, not "${values[flag]}".`);
    process.exit(1);
  }
  return effort;
};
const effort = effortNamed("effort");
const judgeEffort = effortNamed("judge-effort");

const gitOutput = async (args: readonly string[]): Promise<string> => {
  const { stdout } = await run("git", [...args]);
  return stdout.trim();
};

/**
 * The conditions the score was produced under, so two runs can be told apart as
 * incomparable without anyone having to remember why. The model is pinned; these
 * cannot be, so they are recorded instead — an unrecorded change in any of them
 * reads as a skill regression.
 */
const environment = async (): Promise<Record<string, string>> => {
  const cliVersion = await run("claude", ["--version"])
    .then(({ stdout }) => stdout.trim())
    .catch(() => "unknown");

  const baseUrl = process.env.ANTHROPIC_BASE_URL;

  return {
    runner: process.env.CI ? "ci" : "local",
    cliVersion,
    // Host only: a base URL can carry a token, and this is not the place for one.
    apiBaseUrl: baseUrl === undefined ? "default" : (URL.parse(baseUrl)?.host ?? "invalid"),
  };
};

const env = await environment();
const commitSha = await gitOutput(["rev-parse", "HEAD"]);
const gitBranch = await gitOutput(["rev-parse", "--abbrev-ref", "HEAD"]);
// The arm is in the default name because two runs that differ only by arm and
// are told apart only by a timestamp are two runs nobody can read a month later.
const runName = values["run-name"] ?? `${arm}-${gitBranch}@${commitSha.slice(0, 7)}-${Date.now()}`;

const otel = new NodeSDK({ spanProcessors: [new LangfuseSpanProcessor()] });
otel.start();

const langfuse = new LangfuseClient();

// Both calls upsert, so syncing an edited prompt is the same command as the first run.
await langfuse.api.datasets
  .create({
    name: gateName,
    description: `Does an agent apply the rules in .claude/skills? One item per rule, gate ${gateName}.`,
  })
  .catch(() => {});

await Promise.all(
  gateTasks.map((task) =>
    langfuse.api.datasetItems.create({
      id: task.id,
      datasetName: gateName,
      input: { prompt: task.prompt },
      expectedOutput: task.grader,
      // The task id travels in metadata because the runner hands a task nothing
      // else it could use to find the trial it is supposed to spawn.
      metadata: { taskId: task.id, rationale: task.rationale },
    }),
  ),
);

const taskById = new Map(gateTasks.map((task) => [task.id, task]));

const findTask = (metadata: unknown): EvalTask | undefined => {
  const taskId = (metadata as { taskId?: unknown } | undefined)?.taskId;
  return typeof taskId === "string" ? taskById.get(taskId) : undefined;
};

/**
 * The grader travels on the item itself, so an item this suite no longer knows
 * scores as unresolved rather than silently defaulting to a verdict — a default
 * that reads as a real result.
 */
const graderOf = (expectedOutput: unknown): Grader | undefined => {
  const grader = (expectedOutput ?? {}) as Partial<Grader> & Record<string, unknown>;
  if (typeof grader.family !== "string") return undefined;

  if (grader.kind === "diff") {
    const knownFamily =
      grader.family === "effects" ||
      grader.family === "memoization" ||
      grader.family === "sorting" ||
      grader.family === "sets";
    const knownExpect = grader.expect === "none" || grader.expect === "some";
    return knownFamily && knownExpect
      ? { kind: "diff", family: grader.family, expect: grader.expect }
      : undefined;
  }

  if (grader.kind === "judge" && typeof grader.criterion === "string") {
    return { kind: "judge", family: grader.family, criterion: grader.criterion };
  }

  return undefined;
};

/**
 * One dataset item's result: `repeat` trials of the same task. The trials are
 * kept apart rather than reduced here, so the evaluator can grade each one and
 * report how many of them passed.
 */
type ItemOutcome =
  | { readonly status: "skipped" }
  | { readonly status: "attempted"; readonly trials: readonly TrialOutcome[] };

/**
 * One trial's verdict. `unanswered` is not a failure of the agent: it is the
 * trial that could not run or the judge that could not be reached, and it must
 * stay distinguishable from a zero. `source` says which, because the two are
 * fixed in different places — a rate limit on the subject's token, a model the
 * judge could not reach.
 */
type Verdict =
  | { readonly kind: "graded"; readonly passed: boolean; readonly comment: string }
  | { readonly kind: "unanswered"; readonly source: "trial" | "judge"; readonly comment: string };

const gradeTrial = async (
  trial: TrialOutcome,
  grader: Grader,
  prompt: string,
): Promise<Verdict> => {
  if (trial.status === "unavailable") {
    return { kind: "unanswered", source: "trial", comment: trial.reason };
  }

  if (grader.kind === "diff") {
    const grade = gradeAdded(trial.diff, grader);
    return { kind: "graded", passed: grade.passed, comment: grade.comment };
  }

  const verdict = await judge({
    criterion: grader.criterion,
    prompt,
    diff: trial.diff,
    summary: trial.summary,
    model: values["judge-model"],
    effort: judgeEffort,
  });

  return verdict.kind === "unavailable"
    ? { kind: "unanswered", source: "judge", comment: verdict.reason }
    : { kind: "graded", passed: verdict.passed, comment: verdict.reason };
};

const reusable = values.reuse ? await cachedTaskIds(arm, values.model, effort, repeat) : [];
if (reusable.length > 0) {
  console.log(`Reusing stored trials: ${reusable.join(", ")}`);
}

const dataset = await langfuse.dataset.get(gateName);

const result = await dataset.runExperiment({
  name: runName,
  description: `${gateName}, ${arm}, ${values.model} at ${effort}, ${selected.length} task(s), commit ${commitSha.slice(0, 7)}`,
  maxConcurrency: concurrency,
  metadata: {
    "langfuse.commit": commitSha,
    "langfuse.branch": gitBranch,
    arm,
    gate: gateName,
    model: values.model,
    // Beside the model because it is the same kind of variable: unrecorded, a
    // run at `low` and a run at `high` are two experiments under one name.
    effort,
    // How many samples every per-task score averages. A pass rate read without
    // it says nothing about how much of its movement is noise.
    repeat,
    // A burst of unavailable trials reads beside the concurrency that caused
    // it: a rate limit hit at three abreast is not one hit at one.
    maxConcurrency: concurrency,
    // The judge is pinned separately from the subject and recorded beside it.
    // Two models move in this system, and a run nobody can read the judge of is
    // a run whose verdicts cannot be compared to last month's.
    judgeModel: values["judge-model"],
    judgeEffort,
    maxTurns: Number(values["max-turns"]),
    ...env,
  },
  task: async ({ metadata }): Promise<ItemOutcome> => {
    const evalTask = findTask(metadata);
    if (!evalTask) {
      return { status: "attempted", trials: [{ status: "unavailable", reason: "unknown task" }] };
    }
    if (!selected.includes(evalTask)) return { status: "skipped" };

    const trials: TrialOutcome[] = [];
    // Serial: these are the samples one score averages, and `--max-concurrency`
    // says why they do not race each other.
    const label = `${evalTask.id} [${arm}]`;
    for (let repetition = 1; repetition <= repeat; repetition += 1) {
      console.log(`\n--- ${label} trial ${repetition}/${repeat}`);
      // oxlint-disable-next-line no-await-in-loop -- serial on purpose, see above
      const outcome = await runTrial({
        task: evalTask,
        arm,
        model: values.model,
        effort,
        maxTurns: Number(values["max-turns"]),
        repetition,
        reuse: values.reuse,
      });
      // Prefixed, because at any concurrency above one this line lands under
      // some other task's header.
      if (outcome.status === "completed") {
        console.log(
          `    ${label}: ${outcome.changedFiles.length} file(s), $${outcome.costUsd.toFixed(2)}`,
        );
      } else {
        console.log(`    ${label}: unavailable, ${outcome.reason}`);
      }
      trials.push(outcome);
    }
    return { status: "attempted", trials };
  },
  evaluators: [
    async ({ input, output, expectedOutput }) => {
      const outcome = output as ItemOutcome;
      if (outcome.status === "skipped") return [];

      const grader = graderOf(expectedOutput);
      if (grader === undefined) {
        return { name: "rule_gate", value: 0, comment: "item carries no grader" };
      }

      const prompt = (input as { prompt?: string }).prompt ?? "";
      const verdicts = await Promise.all(
        outcome.trials.map((trial) => gradeTrial(trial, grader, prompt)),
      );

      const graded = verdicts.filter((verdict) => verdict.kind === "graded");
      const unanswered = verdicts.filter((verdict) => verdict.kind === "unanswered");

      // A trial that could not run, or a judge that could not answer, must not
      // publish a zero. Either is indistinguishable, on the chart, from a skill
      // that regressed — and this suite exists because unattributable numbers
      // are what it is trying to stop producing. The count says how many of the
      // repetitions it swallowed, so a score averaged over fewer samples than
      // the run asked for says so.
      const errors = (["trial", "judge"] as const).flatMap((source) => {
        const swallowed = unanswered.filter((verdict) => verdict.source === source);
        return swallowed.length === 0
          ? []
          : [
              {
                name: `${source}_error`,
                value: swallowed.length,
                comment: swallowed.map((verdict) => verdict.comment).join(" | "),
              },
            ];
      });

      if (graded.length === 0) return errors;

      const passed = graded.filter((verdict) => verdict.passed).length;
      return [
        ...errors,
        {
          name: scoreName(grader),
          // The mean over the repetitions, so a task that passes once in two
          // reads as 0.5 rather than as whichever trial happened to be graded.
          value: passed / graded.length,
          comment: `${passed}/${graded.length} passed. ${graded
            .map((verdict) => verdict.comment)
            .join(" | ")}`,
        },
      ];
    },
    async ({ output }) => {
      const outcome = output as ItemOutcome;
      if (outcome.status === "skipped") return [];
      // The whole item, repetitions included: what this task cost this run.
      const costUsd = outcome.trials.reduce(
        (total, trial) => total + (trial.status === "completed" ? trial.costUsd : 0),
        0,
      );
      return { name: "trial_cost_usd", value: costUsd, comment: `$${costUsd.toFixed(2)}` };
    },
  ],
  runEvaluators: [
    async ({ itemResults }) => {
      const gates = itemResults
        .flatMap((item) => item.evaluations)
        .filter((evaluation) => evaluation.name.endsWith("_gate"))
        .map((evaluation) => Number(evaluation.value));
      // No score at all beats a zero: an empty run must not look like a failure.
      if (gates.length === 0) return [];
      // The mean of means: every task weighs the same whatever happened inside
      // its repetitions, so a task cannot count twice for having been sampled.
      const rate = gates.reduce((sum, value) => sum + value, 0) / gates.length;
      return {
        name: "pass_rate",
        value: rate,
        comment: `${rate.toFixed(2)} over ${gates.length} task(s) × ${repeat} trial(s)`,
      };
    },
  ],
});

console.log(await result.format());
await otel.shutdown();
