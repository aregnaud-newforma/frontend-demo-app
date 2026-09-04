/**
 * Entry point: runs the effects-gate suite and reports it to Langfuse as one
 * dataset run, so the pass rate is a line over time rather than a number in a
 * terminal that scrolls away.
 *
 * Usage: yarn evals [--gate <skill>] [--task <id>] [--arm with-skills|without-skills]
 *                   [--reuse] [--run-name <name>] [--max-turns <n>] [--model <id>]
 *                   [--list-gates]
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
  type Expectation,
  type GradedApi,
} from "./tasks.ts";
import { cachedTaskIds, runTrial, DEFAULT_MODEL, type Arm, type TrialOutcome } from "./trial.ts";

const run = promisify(execFile);

const DEFAULT_GATE = "react";

const { values } = parseArgs({
  options: {
    gate: { type: "string" },
    task: { type: "string" },
    arm: { type: "string", default: "with-skills" },
    reuse: { type: "boolean", default: false },
    "run-name": { type: "string" },
    "max-turns": { type: "string", default: "25" },
    model: { type: "string", default: DEFAULT_MODEL },
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

const ARMS: readonly Arm[] = ["with-skills", "without-skills"];
const arm = ARMS.find((candidate) => candidate === values.arm);
if (arm === undefined) {
  console.error(`No arm named "${values.arm}". Known: ${ARMS.join(", ")}`);
  process.exit(1);
}

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
      expectedOutput: { api: task.api, expect: task.expect },
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

type Expected = { readonly api: GradedApi; readonly expect: Expectation };

/**
 * What the grader needs travels on the item itself, so an item this suite no
 * longer knows scores as unresolved rather than silently defaulting to "nothing
 * expected" — a default that reads as a real verdict.
 */
const expectedOf = (expectedOutput: unknown): Expected | undefined => {
  const { api, expect } = (expectedOutput ?? {}) as { api?: unknown; expect?: unknown };
  const knownApi =
    api === "effects" || api === "memoization" || api === "sorting" || api === "sets";
  const knownExpect = expect === "none" || expect === "some";
  return knownApi && knownExpect ? { api, expect } : undefined;
};

const reusable = values.reuse ? await cachedTaskIds(arm) : [];
if (reusable.length > 0) {
  console.log(`Reusing stored trials: ${reusable.join(", ")}`);
}

const dataset = await langfuse.dataset.get(gateName);

const result = await dataset.runExperiment({
  name: runName,
  description: `${gateName}, ${arm}, ${values.model}, ${selected.length} task(s), commit ${commitSha.slice(0, 7)}`,
  // One trial at a time: each costs real tokens and minutes, and serial output
  // stays readable while it runs.
  maxConcurrency: 1,
  metadata: {
    "langfuse.commit": commitSha,
    "langfuse.branch": gitBranch,
    arm,
    gate: gateName,
    model: values.model,
    maxTurns: Number(values["max-turns"]),
    ...env,
  },
  task: async ({ metadata }) => {
    const evalTask = findTask(metadata);
    if (!evalTask) return { status: "failed", reason: "unknown task" };
    if (!selected.includes(evalTask)) return { status: "skipped" };

    console.log(`\n--- ${evalTask.id} [${arm}]`);
    const outcome = await runTrial({
      task: evalTask,
      arm,
      model: values.model,
      maxTurns: Number(values["max-turns"]),
      reuse: values.reuse,
    });
    if (outcome.status === "completed") {
      console.log(`    ${outcome.changedFiles.length} file(s), $${outcome.costUsd.toFixed(2)}`);
    } else if (outcome.status === "failed") {
      console.log(`    failed: ${outcome.reason}`);
    }
    return outcome;
  },
  evaluators: [
    async ({ output, expectedOutput }) => {
      const outcome = output as TrialOutcome;
      if (outcome.status === "skipped") return [];

      const expected = expectedOf(expectedOutput);
      if (expected === undefined) {
        return { name: "rule_gate", value: 0, comment: "item carries no expectation" };
      }

      const grade =
        outcome.status === "completed"
          ? gradeAdded(outcome.diff, expected.api, expected.expect)
          : { passed: false, effectCount: 0, comment: outcome.reason };
      return {
        name: scoreName(expected.api),
        value: grade.passed ? 1 : 0,
        comment: grade.comment,
      };
    },
    async ({ output }) => {
      const outcome = output as TrialOutcome;
      if (outcome.status === "skipped") return [];
      const costUsd = outcome.status === "completed" ? outcome.costUsd : 0;
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
      const rate = gates.reduce((sum, value) => sum + value, 0) / gates.length;
      return {
        name: "pass_rate",
        value: rate,
        comment: `${gates.filter(Boolean).length}/${gates.length} passed`,
      };
    },
  ],
});

console.log(await result.format());
await otel.shutdown();
