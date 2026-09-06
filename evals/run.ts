/**
 * Entry point: runs the effects-gate suite and reports it to Langfuse as one
 * dataset run, so the pass rate is a line over time rather than a number in a
 * terminal that scrolls away.
 *
 * Usage: yarn evals [--gate <skill>] [--task <id>]
 *                   [--arm with-skills|without-skills|previous-skill] [--baseline-ref <ref>]
 *                   [--repeat <n>] [--max-concurrency <n>] [--reuse] [--run-name <name>]
 *                   [--max-turns <n>] [--agent <id>] [--model <id>] [--effort <level>]
 *                   [--judge-model <id>] [--judge-effort <level>]
 *                   [--list-gates] [--list-agents]
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
  graderSchema,
  scoreName,
  type EvalTask,
  type Grader,
} from "./tasks.ts";
import {
  cachedTaskIds,
  resolveBaseline,
  runTrial,
  skillTree,
  type Arm,
  type Baseline,
  type Treatment,
  type TrialOutcome,
} from "./trial.ts";
import { agentNamed, AGENTS, DEFAULT_AGENT, EFFORTS, type Effort } from "./agents.ts";
import { judge, JUDGE_EFFORT, JUDGE_MODEL } from "./judge.ts";

const run = promisify(execFile);

const DEFAULT_GATE = "react";

const { values } = parseArgs({
  options: {
    gate: { type: "string" },
    task: { type: "string" },
    arm: { type: "string", default: "with-skills" },
    // No default: the arm that needs it is the only one that may carry it.
    "baseline-ref": { type: "string" },
    repeat: { type: "string", default: "2" },
    "max-concurrency": { type: "string", default: "1" },
    reuse: { type: "boolean", default: false },
    "run-name": { type: "string" },
    agent: { type: "string", default: DEFAULT_AGENT.id },
    // No defaults: all three belong to the agent, and a model id pinned here
    // would be handed to a CLI that has never heard of it.
    "max-turns": { type: "string" },
    model: { type: "string" },
    effort: { type: "string" },
    "judge-model": { type: "string", default: JUDGE_MODEL },
    "judge-effort": { type: "string", default: JUDGE_EFFORT },
    "list-gates": { type: "boolean", default: false },
    "list-agents": { type: "boolean", default: false },
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

// Printed for the same reason and read the same way: CI turns a pull request's
// `evals:<agent>` labels into the agent axis of its matrix, and an agent named
// in the workflow instead of here would be a declaration wired into half the
// system. The default travels with the list because the workflow needs it when
// a pull request carries no label at all.
if (values["list-agents"]) {
  console.log(JSON.stringify({ agents: AGENTS.map(({ id }) => id), default: DEFAULT_AGENT.id }));
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
// The gate as a `Gate`, which `gateName` cannot be: it came off the command line.
const gate = gateTasks[0].gate;

/**
 * Who is under test. The suite measures whether a rule changes what an agent
 * writes, and that question is asked of one agent at a time: the arms, the
 * model and the effort all mean something different per CLI, and a run mixing
 * two of them would average scores that were never the same experiment.
 */
const agent = agentNamed(values.agent);
if (agent === undefined) {
  console.error(
    `No agent named "${values.agent}". Known: ${AGENTS.map(({ id }) => id).join(", ")}`,
  );
  process.exit(1);
}

const model = values.model ?? agent.defaultModel;

/**
 * The turn budget, when the agent has one. Rejected rather than dropped for the
 * same reason `--effort` is: a cap recorded in the metadata of a run that never
 * received it makes two incomparable runs look like one experiment.
 */
if (values["max-turns"] !== undefined && agent.defaultMaxTurns === undefined) {
  console.error(`--max-turns has no meaning for ${agent.id}, which has no turn cap.`);
  process.exit(1);
}

const maxTurns =
  values["max-turns"] === undefined ? agent.defaultMaxTurns : Number(values["max-turns"]);
if (maxTurns !== undefined && (!Number.isInteger(maxTurns) || maxTurns < 1)) {
  console.error(`--max-turns takes a whole number of turns, not "${values["max-turns"]}".`);
  process.exit(1);
}

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

const ARMS: readonly Arm[] = ["with-skills", "without-skills", "previous-skill"];
const arm = ARMS.find((candidate) => candidate === values.arm);
if (arm === undefined) {
  console.error(`No arm named "${values.arm}". Known: ${ARMS.join(", ")}`);
  process.exit(1);
}

/**
 * The text under test, and the text it is compared to. Recorded for every arm,
 * because it is what pairs a `with-skills` run with the `previous-skill` run
 * beside it — two runs an hour apart are otherwise told apart by the clock.
 */
const skillTreeAtHead = await skillTree(gate, "HEAD");

// A ref on an arm that would not restore it is rejected, for the reason
// `--effort` is: a baseline in the metadata of a run that never used one makes
// two incomparable runs look like one experiment.
const baselineRef = values["baseline-ref"];
if (arm !== "previous-skill" && baselineRef !== undefined) {
  console.error(`--baseline-ref has no meaning for the ${arm} arm.`);
  process.exit(1);
}

const baselineAt = async (ref: string | undefined): Promise<Baseline> => {
  if (ref === undefined) {
    console.error(
      "--arm previous-skill needs --baseline-ref: the commit whose skill is the baseline.",
    );
    process.exit(1);
  }
  const baseline = await resolveBaseline(ref, gate).catch(() => undefined);
  if (baseline === undefined) {
    console.error(`No skill directory for gate "${gate}" at "${ref}".`);
    process.exit(1);
  }
  // Paying for both sides of a comparison whose sides are the same text is the
  // one thing this arm exists to avoid.
  if (baseline.tree === skillTreeAtHead) {
    console.error(`Nothing to compare: .claude/skills/${gate} is identical at ${ref} and HEAD.`);
    process.exit(1);
  }
  return baseline;
};

const treatment: Treatment =
  arm === "previous-skill" ? { arm, baseline: await baselineAt(baselineRef) } : { arm };

const effortNamed = (
  flag: "effort" | "judge-effort",
  value: string,
  allowed: readonly Effort[],
): Effort => {
  const effort = allowed.find((candidate) => candidate === value);
  if (effort === undefined) {
    console.error(`--${flag} takes one of ${allowed.join(", ")}, not "${value}".`);
    process.exit(1);
  }
  return effort;
};

// Rejected rather than dropped: an effort the CLI never received, recorded in
// the run metadata as though it had been, is a run that cannot be compared to
// any other. The levels differ per agent, so the list is the agent's.
if (values.effort !== undefined && agent.efforts.length === 0) {
  console.error(`--effort has no meaning for ${agent.id}, which takes no reasoning effort.`);
  process.exit(1);
}

const effort =
  values.effort === undefined
    ? agent.defaultEffort
    : effortNamed("effort", values.effort, agent.efforts);
// Always a level, out of all of them: the judge is Claude whichever agent is
// under test.
const judgeEffort = effortNamed("judge-effort", values["judge-effort"], EFFORTS);

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
  const cliVersion = await agent.version();

  const baseUrl = agent.apiBaseUrlEnv === undefined ? undefined : process.env[agent.apiBaseUrlEnv];

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
      input: { prompts: task.prompts },
      expectedOutput: task.grader,
      // The task id travels in metadata because the runner hands a task nothing
      // else it could use to find the trial it is supposed to spawn.
      metadata: { taskId: task.id, rationale: task.rationale },
    }),
  ),
);

const taskById = new Map(gateTasks.map((task) => [task.id, task]));

// Upsert never deletes, and the experiment iterates the dataset rather than
// `tasks.ts`: a task renamed or dropped leaves an item behind that the run still
// picks up, spawns nothing for, and reports as `unknown task` — a trial error
// standing in for a task that no longer exists. Archiving is what the list
// endpoint filters on, and unlike a delete it keeps the runs that item already
// scored: the line over time this suite draws is made of those.
const { data: liveItems } = await langfuse.api.datasetItems.list({
  datasetName: gateName,
  // One page, because a gate is a handful of rules and archived items stop
  // coming back — the list this filters can only be that handful plus whatever
  // one edit of `tasks.ts` just orphaned.
  limit: 100,
});

const orphans = liveItems.filter((item) => !taskById.has(item.id));
if (orphans.length > 0) {
  await Promise.all(
    orphans.map((item) =>
      langfuse.api.datasetItems.create({
        id: item.id,
        datasetName: gateName,
        // Resent because the upsert writes the whole item: omitting these
        // archives the item and empties it, and an emptied item is a past run
        // nobody can read the prompt of.
        input: item.input,
        expectedOutput: item.expectedOutput,
        metadata: item.metadata,
        status: "ARCHIVED",
      }),
    ),
  );
  console.log(`Archived, no longer in tasks.ts: ${orphans.map((item) => item.id).join(", ")}`);
}

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
  const parsed = graderSchema.safeParse(expectedOutput);
  return parsed.success ? parsed.data : undefined;
};

/**
 * One dataset item's result: every prompt of the task, `repeat` times over. The
 * trials are kept apart rather than reduced here, so the evaluator can grade
 * each one and report how many of them passed. Each carries which prompt it was
 * given, because a judged criterion is read against that prompt.
 */
type Trial = { readonly variant: number; readonly outcome: TrialOutcome };

type ItemOutcome =
  | { readonly status: "skipped" }
  | { readonly status: "attempted"; readonly trials: readonly Trial[] };

/**
 * One trial's verdict. `unanswered` is not a failure of the agent: it is the
 * trial that could not run, the agent `--max-turns` cut off before the summary
 * a judge reads, or the judge that could not be reached, and it must stay
 * distinguishable from a zero. `source` says which side, because they are fixed
 * in different places — a rate limit or a turn budget on the subject, a model
 * the judge could not reach.
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

  // The judge is told that silence is failure, which is right when the agent
  // chose to say nothing and wrong when the CLI cut it off first. A criterion
  // about *why* cannot be answered from a diff alone, so this trial has no
  // verdict — not a failed one.
  if (trial.stop === "max-turns") {
    return {
      kind: "unanswered",
      source: "trial",
      comment: `out of turns after ${trial.turns ?? maxTurns}, no summary for the judge to read`,
    };
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

const reusable = values.reuse
  ? await cachedTaskIds({ tasks: selected, agentId: agent.id, treatment, model, effort, repeat })
  : [];
if (reusable.length > 0) {
  console.log(`Reusing stored trials: ${reusable.join(", ")}`);
}

const dataset = await langfuse.dataset.get(gateName);

const result = await dataset.runExperiment({
  name: runName,
  description: `${gateName}, ${arm}, ${agent.id} ${model}${effort === undefined ? "" : ` at ${effort}`}, ${selected.length} task(s), commit ${commitSha.slice(0, 7)}`,
  maxConcurrency: concurrency,
  metadata: {
    "langfuse.commit": commitSha,
    "langfuse.branch": gitBranch,
    arm,
    gate: gateName,
    skillTree: skillTreeAtHead,
    // "none" on the arms that restore nothing, which is not the same claim as
    // a baseline that went unrecorded.
    baselineRef: treatment.arm === "previous-skill" ? treatment.baseline.ref : "none",
    baselineCommit: treatment.arm === "previous-skill" ? treatment.baseline.commit : "none",
    baselineSkillTree: treatment.arm === "previous-skill" ? treatment.baseline.tree : "none",
    agent: agent.id,
    model,
    // Beside the model because it is the same kind of variable: unrecorded, a
    // run at `low` and a run at `high` are two experiments under one name.
    // "none" is an agent with no such setting, which is not the same claim as
    // an unrecorded one.
    effort: effort ?? "none",
    // How many passes over its prompts every per-task score averages. A pass
    // rate read without it says nothing about how much of its movement is noise.
    repeat,
    // A burst of unavailable trials reads beside the concurrency that caused
    // it: a rate limit hit at three abreast is not one hit at one.
    maxConcurrency: concurrency,
    // The judge is pinned separately from the subject and recorded beside it.
    // Two models move in this system, and a run nobody can read the judge of is
    // a run whose verdicts cannot be compared to last month's.
    judgeModel: values["judge-model"],
    judgeEffort,
    // "none" is an agent with no turn cap, which is not the same claim as a cap
    // that went unrecorded.
    maxTurns: maxTurns ?? "none",
    ...env,
  },
  task: async ({ metadata }): Promise<ItemOutcome> => {
    const evalTask = findTask(metadata);
    if (!evalTask) {
      return {
        status: "attempted",
        trials: [{ variant: 1, outcome: { status: "unavailable", reason: "unknown task" } }],
      };
    }
    if (!selected.includes(evalTask)) return { status: "skipped" };

    const trials: Trial[] = [];
    // Serial: these are the samples one score averages, and `--max-concurrency`
    // says why they do not race each other. A pass covers every prompt before
    // the next pass starts, so a run cut short still holds whole passes.
    const label = `${evalTask.id} [${arm}]`;
    const variants = evalTask.prompts.length;
    for (let repetition = 1; repetition <= repeat; repetition += 1) {
      for (let variant = 1; variant <= variants; variant += 1) {
        console.log(`\n--- ${label} prompt ${variant}/${variants} trial ${repetition}/${repeat}`);
        // oxlint-disable-next-line no-await-in-loop -- serial on purpose, see above
        const outcome = await runTrial({
          task: evalTask,
          agent,
          treatment,
          model,
          effort,
          maxTurns,
          variant,
          repetition,
          reuse: values.reuse,
        });
        // Prefixed, because at any concurrency above one this line lands under
        // some other task's header.
        if (outcome.status === "completed") {
          const cutOff = outcome.stop === "max-turns" ? ", out of turns" : "";
          const cost = outcome.costUsd === undefined ? "" : `, $${outcome.costUsd.toFixed(2)}`;
          console.log(`    ${label}: ${outcome.changedFiles.length} file(s)${cost}${cutOff}`);
        } else {
          console.log(`    ${label}: unavailable, ${outcome.reason}`);
        }
        trials.push({ variant, outcome });
      }
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

      const prompts = (input as { prompts?: readonly string[] }).prompts ?? [];
      const verdicts = await Promise.all(
        outcome.trials.map(({ variant, outcome: trial }) =>
          gradeTrial(trial, grader, prompts[variant - 1] ?? ""),
        ),
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
      // The whole item, repetitions included: what this task cost this run. No
      // score at all when the CLI reports no price — a zero would read as a free
      // run rather than as an agent that does not say.
      const costs = outcome.trials.flatMap(({ outcome: trial }) =>
        trial.status === "completed" && trial.costUsd !== undefined ? [trial.costUsd] : [],
      );
      if (costs.length === 0) return [];

      const costUsd = costs.reduce((total, cost) => total + cost, 0);
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
        comment: `${rate.toFixed(2)} over ${gates.length} task(s), ${repeat} pass(es) over each one's prompts`,
      };
    },
  ],
});

console.log(await result.format());
await otel.shutdown();
