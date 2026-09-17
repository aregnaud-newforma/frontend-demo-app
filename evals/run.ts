/**
 * Entry point: runs the effects-gate suite and reports it to Langfuse as one
 * dataset run, so the pass rate is a line over time rather than a number in a
 * terminal that scrolls away.
 *
 * Usage: yarn evals --gate <skill> [--task <id>]
 *                   [--arm with-skills|without-skills|previous-skill] [--baseline-ref <ref>]
 *                   [--repeat <n>] [--max-concurrency <n>] [--reuse] [--run-name <name>]
 *                   [--max-turns <n>] [--agent <id>] [--model <id>] [--effort <level>]
 *                   [--judge-agent <id>] [--judge-model <id>] [--judge-effort <level>]
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
import { config, configuredDefaults } from "./config.ts";
import {
  gatesWithTasks,
  gradeAdded,
  graderSchema,
  scoreName,
  type EvalTask,
  type Grader,
} from "./grading.ts";
import {
  cachedTaskIds,
  resolveBaseline,
  runTrial,
  type Arm,
  type Baseline,
  type Treatment,
  type TrialOutcome,
} from "./trial.ts";
import { agentNamed, AGENTS, DEFAULT_AGENT, type Effort } from "./agents.ts";
import { judge, judgeNamed, DEFAULT_JUDGE, JUDGES } from "./judge.ts";
import { resolveSkills } from "./skills.ts";
import { pin } from "./pin.ts";

const run = promisify(execFile);

/** This repository's rules, from `evals.config.ts`. */
const { tasks: TASKS } = config;

/**
 * Who a run is about when nobody says: this repository's choice, or the
 * harness's when it has none. Validated as it was loaded, so it names an agent.
 */
const defaultAgentId = config.defaultAgent ?? DEFAULT_AGENT.id;

/** Who grades when nobody says, resolved as the subject above and apart from it. */
const defaultJudgeId = config.defaultJudge ?? DEFAULT_JUDGE.id;

const { values } = parseArgs({
  options: {
    gate: { type: "string" },
    task: { type: "string" },
    arm: { type: "string", default: "with-skills" },
    // No default: the arm that needs it is the only one that may carry it.
    "baseline-ref": { type: "string" },
    repeat: { type: "string", default: "1" },
    // No default: it is the last link of a chain, and a default here would win
    // over `evals.config.ts` before the config was ever read.
    "max-concurrency": { type: "string" },
    reuse: { type: "boolean", default: false },
    "run-name": { type: "string" },
    // No default: it is the last link of a chain, and a default here would win
    // over `evals.config.ts` before the config was ever read.
    agent: { type: "string" },
    // No defaults: all three belong to the agent, and a model id pinned here
    // would be handed to a CLI that has never heard of it.
    "max-turns": { type: "string" },
    model: { type: "string" },
    effort: { type: "string" },
    // No defaults, for the reason the subject's three have none: they belong to
    // whichever judge `--judge-agent` names, and a model id pinned here would be
    // handed to a CLI that has never heard of it.
    "judge-agent": { type: "string" },
    "judge-model": { type: "string" },
    "judge-effort": { type: "string" },
    "list-gates": { type: "boolean", default: false },
    "list-agents": { type: "boolean", default: false },
  },
});

// Printed for CI, which builds its job matrix from it. Reading the gates from
// here rather than listing them again in the workflow keeps `tasks.ts` the one
// place a gate is declared — the failure `alias.ts` and tsconfig `paths` warn
// about, where half a declaration is wired and the other half rots.
if (values["list-gates"]) {
  console.log(JSON.stringify(gatesWithTasks(TASKS)));
  process.exit(0);
}

// Printed for the same reason and read the same way: CI turns a pull request's
// `evals:<agent>` labels into the agent axis of its matrix, and an agent named
// in the workflow instead of here would be a declaration wired into half the
// system. The default travels with the list because the workflow needs it when
// a pull request carries no label at all, and it is the resolved one — so an
// `evals.config.ts` that names an agent moves CI and a bare `yarn evals`
// together rather than leaving the two disagreeing.
if (values["list-agents"]) {
  console.log(JSON.stringify({ agents: AGENTS.map(({ id }) => id), default: defaultAgentId }));
  process.exit(0);
}

const requested = values.task ? TASKS.find((task) => task.id === values.task) : undefined;
if (values.task && !requested) {
  console.error(`No task named "${values.task}". Known: ${TASKS.map((t) => t.id).join(", ")}`);
  process.exit(1);
}

const knownGates = gatesWithTasks(TASKS);

/**
 * Which gate this run measures. A named task settles it on its own — asking for
 * both is a way to get a run that silently scores nothing — and a repository
 * with one gate has nothing to choose. Anything else has to be asked for: a
 * default would quietly measure one skill out of five and report the number as
 * the suite's.
 */
const gate =
  requested?.gate ?? values.gate ?? (knownGates.length === 1 ? knownGates[0] : undefined);
if (gate === undefined) {
  console.error(`--gate is required. Known: ${knownGates.join(", ")}`);
  process.exit(1);
}

const gateTasks = TASKS.filter((task) => task.gate === gate);
if (gateTasks.length === 0) {
  console.error(`No gate named "${gate}". Known: ${knownGates.join(", ")}`);
  process.exit(1);
}

const selected = requested ? [requested] : gateTasks;

/**
 * Who is under test. The suite measures whether a rule changes what an agent
 * writes, and that question is asked of one agent at a time: the arms, the
 * model and the effort all mean something different per CLI, and a run mixing
 * two of them would average scores that were never the same experiment.
 *
 * `--agent` first, then whoever `evals.config.ts` named, then the harness's
 * own. Only the flag can be wrong by this point: the config's was checked when
 * it was loaded, and the harness's is one of the agents it declares.
 */
const agentId = values.agent ?? defaultAgentId;
const agent = agentNamed(agentId);
if (agent === undefined) {
  console.error(`No agent named "${agentId}". Known: ${AGENTS.map(({ id }) => id).join(", ")}`);
  process.exit(1);
}

/**
 * What this repository asks of whoever it resolved, when it asks anything. The
 * flag still wins over it, and the adapter's pin is what both mean when neither
 * says — one value, three sources, the chain `--agent` already has.
 */
const configuredAgent = configuredDefaults("agents", agent.id);

const model = values.model ?? configuredAgent.model ?? agent.defaultModel;

/**
 * Who grades the criteria the diff graders cannot. Resolved exactly as the
 * subject is and kept apart from it on purpose: the judge is the instrument, so
 * grading Codex's diff with Codex would change the ruler and the thing being
 * measured at once, and no two runs of this suite would be comparable again.
 * Nothing here stops that — only recording it does, which the metadata below
 * does beside the judge's model.
 *
 * Defaulted rather than pinned so a machine with no `claude` CLI has somewhere
 * to go, and so the bias a Claude judge has reading a Claude subject can be
 * measured against a second vendor rather than assumed absent. `--judge-agent`
 * first, then `defaultJudge` in `evals.config.ts`, then the harness's own — the
 * chain `--agent` has, and separate from it at every link.
 */
const judgeAgentId = values["judge-agent"] ?? defaultJudgeId;
const judgeAgent = judgeNamed(judgeAgentId);
if (judgeAgent === undefined) {
  console.error(
    `No judge named "${judgeAgentId}". Known: ${JUDGES.map(({ id }) => id).join(", ")}`,
  );
  process.exit(1);
}

const configuredJudge = configuredDefaults("judges", judgeAgent.id);

const judgeModel = values["judge-model"] ?? configuredJudge.model ?? judgeAgent.defaultModel;

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
 * How many trials each task gets. Repeating turns the per-task score into a mean,
 * so the variance shows in the number instead of hiding inside it.
 *
 * One by default, which is a coin flipped once: the gate score is then 1 or 0,
 * and a gate moving from 5/5 to 4/5 is as easily sampling noise as a skill that
 * regressed. The default is the cheap question — did this edit break something
 * obvious — because that is the run people actually type, and a default that
 * doubled its bill would be paid on every run to answer a question most of them
 * were not asking.
 *
 * Raise it for the run that is asking: 2 is the smallest count that can disagree
 * with itself, and 5 or 10 for two arms sitting within a point of each other,
 * which is precisely what repetition answers and where the money is worth
 * spending. `repeat` travels in the run metadata, so a pass rate is always read
 * beside the number of samples it averages.
 */
const repeat = Number(values.repeat);
if (!Number.isInteger(repeat) || repeat < 1) {
  console.error(`--repeat takes a whole number of trials per task, not "${values.repeat}".`);
  process.exit(1);
}

/**
 * How many tasks run at once. One when nobody says, because a trial is minutes
 * and real money and output that interleaves is output nobody reads while it
 * runs. CI reads nothing while it runs and pays by the wall clock, so it raises
 * this: a gate of five tasks at three abreast finishes in two waves instead of
 * five. `evals.config.ts` may raise it too, for a repository whose runs are
 * normally unattended — the flag, then the config, then this one.
 *
 * Tasks, not trials: a task's repetitions stay serial inside it, so the samples
 * a score averages never compete with each other for the same rate limit.
 */
const concurrency =
  values["max-concurrency"] === undefined
    ? (config.maxConcurrency ?? 1)
    : Number(values["max-concurrency"]);
// Only the flag can still be wrong: the config's was checked as it was loaded.
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
 * The rules this run installs, resolved once before any trial and handed to all
 * of them. Recorded for every arm, because it is what pairs a `with-skills` run
 * with the `previous-skill` run beside it — two runs an hour apart are otherwise
 * told apart by the clock.
 *
 * Resolved here rather than inside a trial because the cache key is built before
 * the worktree exists: rules resolved any later would key a trial by text it had
 * not been given.
 */
const skills = await resolveSkills(knownGates).catch((error: unknown): never => {
  console.error(
    `Could not read the rules for gate "${gate}" at ${pin.ref} of ${pin.url}: ${String(error)}`,
  );
  console.error("They live in evals/skills.pin.json. Check the ref, the path, and your access.");
  process.exit(1);
});

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
    console.error(`No rules for gate "${gate}" at "${ref}" of the skills repository.`);
    process.exit(1);
  }
  // Paying for both sides of a comparison whose sides are the same text is the
  // one thing this arm exists to avoid.
  if (baseline.tree === (await resolveSkills([gate])).tree) {
    console.error(`Nothing to compare: the ${gate} rules are identical at ${ref} and ${pin.ref}.`);
    process.exit(1);
  }
  return baseline;
};

const treatment: Treatment =
  arm === "previous-skill"
    ? { arm, skills, baseline: await baselineAt(baselineRef) }
    : { arm, skills };

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

// The config's own effort was checked against this agent as it was loaded, so
// only the flag can still be wrong here.
const effort =
  values.effort === undefined
    ? (configuredAgent.effort ?? agent.defaultEffort)
    : effortNamed("effort", values.effort, agent.efforts);

if (values["judge-effort"] !== undefined && judgeAgent.efforts.length === 0) {
  console.error(
    `--judge-effort has no meaning for ${judgeAgent.id}, which takes no reasoning effort.`,
  );
  process.exit(1);
}

const judgeEffort =
  values["judge-effort"] === undefined
    ? (configuredJudge.effort ?? judgeAgent.defaultEffort)
    : effortNamed("judge-effort", values["judge-effort"], judgeAgent.efforts);

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
    name: gate,
    description: `Does an agent apply the rules in .claude/skills? One item per rule, gate ${gate}.`,
  })
  .catch(() => {});

await Promise.all(
  gateTasks.map((task) =>
    langfuse.api.datasetItems.create({
      id: task.id,
      datasetName: gate,
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
  datasetName: gate,
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
        datasetName: gate,
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

/**
 * Every verdict the run could not reach: a CLI that would not start or
 * authenticate, a rate limit, a judge that could not be reached, a turn budget
 * that cut the agent off before the summary a judge reads. Each is the run
 * failing to measure, not the agent being measured — the last one is a
 * `--max-turns` too small for the task, which the README says to raise — and
 * together they are what makes the process exit non-zero at the end.
 */
const unreachable: string[] = [];

const gradeTrial = async (
  trial: TrialOutcome,
  grader: Grader,
  prompt: string,
): Promise<Verdict> => {
  if (trial.status === "unavailable") {
    unreachable.push(trial.reason);
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
    const comment = `out of turns after ${trial.turns ?? maxTurns}, no summary for the judge to read`;
    unreachable.push(comment);
    return { kind: "unanswered", source: "trial", comment };
  }

  const verdict = await judge({
    criterion: grader.criterion,
    prompt,
    diff: trial.diff,
    summary: trial.summary,
    judge: judgeAgent,
    model: judgeModel,
    effort: judgeEffort,
  });

  if (verdict.kind === "unavailable") {
    unreachable.push(verdict.reason);
    return { kind: "unanswered", source: "judge", comment: verdict.reason };
  }
  return { kind: "graded", passed: verdict.passed, comment: verdict.reason };
};

const reusable = values.reuse
  ? await cachedTaskIds({ tasks: selected, agentId: agent.id, treatment, model, effort, repeat })
  : [];
if (reusable.length > 0) {
  console.log(`Reusing stored trials: ${reusable.join(", ")}`);
}

const dataset = await langfuse.dataset.get(gate);

const result = await dataset.runExperiment({
  name: runName,
  // Passed as the run name too, verbatim: left out, the SDK stores
  // `${name} - ${timestamp}` and the deletion below asks for a run that does
  // not exist. A run that could not be measured then stayed on the chart with
  // a 404 in the job log — the first one this suite deleted taught it that.
  runName,
  description: `${gate}, ${arm}, ${agent.id} ${model}${effort === undefined ? "" : ` at ${effort}`}, ${selected.length} task(s), commit ${commitSha.slice(0, 7)}`,
  maxConcurrency: concurrency,
  metadata: {
    "langfuse.commit": commitSha,
    "langfuse.branch": gitBranch,
    arm,
    gate: gate,
    // Which rules, from which repository, at which revision. `skillTree` is the
    // text itself and `skillsCommit` the commit that carried it: a branch moves
    // while its rules stay put, and only the first can say two runs measured one
    // thing.
    skillTree: skills.tree,
    skillsRef: skills.ref,
    skillsCommit: skills.commit,
    skillsRepo: pin.url,
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
    judgeAgent: judgeAgent.id,
    judgeModel,
    // "none" is a judge with no effort setting, which is not the same claim as
    // an unrecorded one.
    judgeEffort: judgeEffort ?? "none",
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
    /**
     * Whether the gate's own skill was loaded at all. A `*_gate` score that
     * moves is otherwise two hypotheses in one number — the rule stopped
     * working, or the agent never reached for it — and until now the evidence
     * sat unread in the agent's tool calls.
     *
     * On the `without-skills` arm it is the strip verifying itself. The score
     * belongs at 0 there; anything above it means `stripSkills` left the skill
     * somewhere the agent could still find, and the two arms of that comparison
     * were never the two treatments the run says they were.
     */
    async ({ output }) => {
      const outcome = output as ItemOutcome;
      if (outcome.status === "skipped") return [];

      // Only the trials whose agent can answer. An agent that reports no tool
      // calls is not an agent that loaded nothing, and a zero standing in for
      // the difference reads as a skill that never fires.
      const answered = outcome.trials.flatMap(({ outcome: trial }) =>
        trial.status === "completed" && trial.skillsInvoked !== undefined
          ? [trial.skillsInvoked]
          : [],
      );
      if (answered.length === 0) return [];

      // A plugin's skill is invoked as `plugin:skill`, so the gate is the tail
      // of the name rather than the whole of it.
      const isGate = (skill: string): boolean => skill === gate || skill.endsWith(`:${gate}`);

      const loaded = answered.filter((skills) => skills.some(isGate)).length;
      // Every skill any trial reached for, named in the comment: a gate that
      // never loads while a neighbour always does is the diagnosis, and it is
      // invisible in the number alone.
      const named = [...new Set(answered.flat())];

      return {
        name: "skill_invoked",
        value: loaded / answered.length,
        comment: `${gate} loaded in ${loaded}/${answered.length} trial(s). Invoked: ${named.length === 0 ? "none" : named.join(", ")}`,
      };
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

// A run that could not reach every verdict is not a measurement, and it does
// not stay on the chart: the dataset run is deleted and the process exits
// non-zero, which is what CI reads. The report above, printed before this and
// copied into the job summary, is where the reasons live — a run kept on the
// chart with `trial_error` counts was the earlier design, and it made every
// comparison a month later start by sorting the runs that measured from the
// runs that did not. A red score with every trial answered is a result, not a
// failure: it stays, and exits zero.
//
// The traces stay too: `deleteRun` removes the run and its items, not the
// traces they pointed at, and a trace still says what a failed trial cost.
// Deleted after the flush, so nothing arriving late can recreate the run.
if (unreachable.length > 0) {
  console.error(
    `${unreachable.length} trial(s) could not be run or graded, so this run is not a measurement and is not kept:`,
  );
  for (const reason of new Set(unreachable)) console.error(`  ${reason}`);
  await langfuse.api.datasets.deleteRun(gate, runName).catch((error: unknown) => {
    console.error(`Could not delete run ${runName} from dataset ${gate}: ${String(error)}`);
  });
  process.exit(1);
}
