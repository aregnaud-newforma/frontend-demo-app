import { execFile } from "node:child_process";
import { access, mkdir, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { describeFailure, type Agent, type AgentStop, type Effort } from "./agents.ts";
import type { EvalTask, Gate } from "./tasks.ts";

const run = promisify(execFile);

const REPO_ROOT = new URL("..", import.meta.url).pathname;
const RUNS_DIR = join(REPO_ROOT, "evals", ".runs");

/** Only source files are graded; a change to a config or a doc is not an answer. */
const SOURCE_PATHS = [":(glob)src/**/*.ts", ":(glob)src/**/*.tsx"];

/**
 * Which arm a trial belongs to. "without-skills" answers the question a pass
 * alone cannot: whether the skill caused the pass, or the model already knew the
 * rule and the skill is decoration. "previous-skill" answers a narrower one:
 * whether an edit to the skill moved anything, against the same code, harness,
 * CLI and hour — the one baseline last night's run cannot be.
 *
 * Comparable within one agent only. Each agent reads its rules from a different
 * place and loads them differently — Claude pulls a skill in on demand, an agent
 * with only an `AGENTS.md` has the whole body in context from the first token —
 * so the arms are not the same treatment across agents. The delta between
 * them is the measurement that travels; the absolute pass rate is not.
 */
export type Arm = "with-skills" | "without-skills" | "previous-skill";

/**
 * What "previous-skill" restores: one gate's skill directory as it was at a
 * commit, inside a worktree that is otherwise HEAD. Carries the directory's tree
 * hash because that, not the ref, is the experiment: `main` moves while its
 * rules stay put, so two refs holding the same text are one baseline, and a
 * ref whose text equals HEAD's has nothing to compare.
 */
export type Baseline = {
  /** As given on the command line, for the run metadata. */
  readonly ref: string;
  /** What it resolved to when the run started. */
  readonly commit: string;
  readonly gate: Gate;
  /** `git rev-parse <commit>:.claude/skills/<gate>`. */
  readonly tree: string;
};

/**
 * The arm together with what it needs, so a "previous-skill" trial cannot be
 * asked for without a baseline and a baseline cannot be handed to an arm that
 * would ignore it.
 */
export type Treatment =
  | { readonly arm: "with-skills" | "without-skills" }
  | { readonly arm: "previous-skill"; readonly baseline: Baseline };

/**
 * Appended when a task's checks policy is "skip". Harness instruction, not part
 * of the prompt under test: it is identical in every arm of a comparison, so it
 * cannot explain a difference between two runs.
 */
const SKIP_CHECKS = [
  "Scoped exercise: make the change and stop.",
  "Do not run `yarn verify`, `yarn test`, `yarn e2e` or `yarn dev`.",
].join(" ");

const promptFor = (task: EvalTask, variant: number): string => {
  const prompt = task.prompts[variant - 1];
  return task.checks === "run" ? prompt : `${prompt}\n\n${SKIP_CHECKS}`;
};

/**
 * The final state of the environment after one attempt. There is no "failed":
 * an agent that answered badly is `completed` with a bad diff, and the grader
 * says so. `unavailable` is the harness, not the agent — a rate limit, a
 * timeout, a worktree that would not add — and it must never be scored, because
 * a zero from a trial that never ran is indistinguishable from a skill that
 * regressed.
 *
 * The telemetry is `| undefined` because it is the agent's to report and not
 * every CLI reports it. Zero would read as a free trial, which is a claim the
 * harness has no evidence for.
 */
export type TrialOutcome =
  | {
      readonly status: "completed";
      readonly diff: string;
      readonly changedFiles: readonly string[];
      readonly summary: string;
      readonly stop: AgentStop;
      readonly costUsd: number | undefined;
      readonly turns: number | undefined;
      readonly durationMs: number | undefined;
    }
  | { readonly status: "unavailable"; readonly reason: string };

const git = async (args: readonly string[], cwd = REPO_ROOT): Promise<string> => {
  const { stdout } = await run("git", [...args], { cwd, maxBuffer: 64 * 1024 * 1024 });
  return stdout;
};

/** A model id is free-form and ends up in a filename; a `/` in one is a lost run. */
const slug = (value: string): string => value.replaceAll(/[^\w.-]/g, "-");

const skillDir = (gate: Gate): string => join(".claude", "skills", gate);

/** The hash of one gate's skill directory at a revision: the text under test. */
export const skillTree = async (gate: Gate, revision: string): Promise<string> =>
  (await git(["rev-parse", `${revision}:${skillDir(gate)}`])).trim();

export const resolveBaseline = async (ref: string, gate: Gate): Promise<Baseline> => ({
  ref,
  gate,
  commit: (await git(["rev-parse", `${ref}^{commit}`])).trim(),
  tree: await skillTree(gate, ref),
});

/**
 * Only the gate's directory moves. The other skills and `AGENTS.md` stay at
 * HEAD in both arms of the comparison, which is what makes them constants.
 * Removed first: a checkout restores what the commit had and leaves alone what
 * it did not, and a rule file added since would otherwise survive into the
 * baseline.
 */
const restoreSkill = async (worktree: string, baseline: Baseline): Promise<void> => {
  const dir = skillDir(baseline.gate);
  await rm(join(worktree, dir), { recursive: true, force: true });
  await git(["checkout", baseline.commit, "--", dir], worktree);
};

/**
 * The arm as it appears in a cache key. A "previous-skill" trial is keyed by
 * the text it was given, not the ref that named it: `--reuse` may serve a
 * trial of `main` to a run that said `HEAD~1` when the two hold the same rules,
 * and must not serve one to the other once `main` has moved.
 */
const armKey = (treatment: Treatment): string =>
  treatment.arm === "previous-skill"
    ? `${treatment.arm}-${treatment.baseline.tree.slice(0, 12)}`
    : treatment.arm;

/**
 * Keyed by agent, arm, model and effort as well as task, because all of them are
 * the measurement. Two arms are two experiments; so are two agents, two models,
 * and two effort levels. A cache keyed on the task alone would let `--reuse`
 * serve a Fable trial into a run whose metadata says Opus — a plausible number
 * that is false, which is the one failure mode this suite exists to stop making.
 *
 * The variant and the repetition are in the key for a smaller version of the
 * same reason: the trials of one task are the samples its score averages, and a
 * key without them would let the second overwrite the first and leave `--reuse`
 * grading one sample as if it were several.
 */
const cacheKey = (options: {
  readonly taskId: string;
  readonly agentId: string;
  readonly treatment: Treatment;
  readonly model: string;
  readonly effort: Effort | undefined;
  readonly variant: number;
  readonly repetition: number;
}): string =>
  [
    options.taskId,
    options.agentId,
    armKey(options.treatment),
    slug(options.model),
    options.effort ?? "no-effort",
    `v${options.variant}`,
    `r${options.repetition}`,
  ].join(".");

const cacheFile = (key: string): string => join(RUNS_DIR, `${key}.json`);

const readCachedOutcome = async (key: string): Promise<TrialOutcome | undefined> => {
  try {
    return JSON.parse(await readFile(cacheFile(key), "utf8")) as TrialOutcome;
  } catch {
    return undefined;
  }
};

/**
 * Points a worktree at the dependencies already installed beside it rather than
 * installing a second copy. The worktree is a checkout of `HEAD` on the same
 * machine, so its `node_modules` would be identical to the one the suite is
 * running from, and building it again cost about twenty seconds per trial —
 * six times over in a CI run, in series, inside billed job time.
 *
 * A symlink, not a copy: `yarn verify` and `yarn test` resolve through it
 * unchanged, and nothing in a trial writes into `node_modules`. `git worktree
 * remove` unlinks it without touching what it points at.
 *
 * Falls back to a real install when the suite is somehow running without its own
 * dependencies, so a trial cannot fail for a reason that has nothing to do with
 * the rule it is measuring.
 */
const linkDependencies = async (worktree: string): Promise<void> => {
  const shared = join(REPO_ROOT, "node_modules");
  const installed = await access(shared).then(
    () => true,
    () => false,
  );

  if (!installed) {
    await run("yarn", ["install", "--frozen-lockfile"], { cwd: worktree });
    return;
  }

  await symlink(shared, join(worktree, "node_modules"), "dir");
};

/**
 * Runs one trial in a git worktree, which is this suite's clean environment:
 * every trial starts from HEAD and cannot read another trial's history. What
 * runs inside it is the agent's business; everything around it is the same
 * whoever the agent is.
 */
export const runTrial = async (options: {
  readonly task: EvalTask;
  readonly agent: Agent;
  readonly treatment: Treatment;
  readonly model: string;
  readonly effort: Effort | undefined;
  /** Undefined for an agent with no turn cap; the timeout is then the budget. */
  readonly maxTurns: number | undefined;
  /** Which of the task's prompts this trial is given, counting from 1. */
  readonly variant: number;
  /** Which pass over the prompts this is, counting from 1. Part of the cache key. */
  readonly repetition: number;
  /** Reuse the stored outcome when one exists, instead of spending a trial. */
  readonly reuse: boolean;
}): Promise<TrialOutcome> => {
  const { task, agent, treatment, model, effort, maxTurns, variant, repetition, reuse } = options;

  const key = cacheKey({
    taskId: task.id,
    agentId: agent.id,
    treatment,
    model,
    effort,
    variant,
    repetition,
  });

  if (reuse) {
    const cached = await readCachedOutcome(key);
    if (cached) return cached;
  }

  const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const worktree = join("/tmp", `eval-${task.id}-${stamp}`);
  const branch = `eval/${task.id}-${stamp}`;

  await git(["worktree", "add", worktree, "-b", branch]);

  try {
    if (treatment.arm === "without-skills") await agent.stripRules(worktree);
    if (treatment.arm === "previous-skill") await restoreSkill(worktree, treatment.baseline);
    await linkDependencies(worktree);

    const attempt = await agent.run({
      prompt: promptFor(task, variant),
      cwd: worktree,
      model,
      effort,
      maxTurns,
    });

    if (attempt.status === "unavailable") return attempt;

    const diff = await git(["diff", "HEAD", "--", ...SOURCE_PATHS], worktree);
    const names = await git(["diff", "HEAD", "--name-only", "--", ...SOURCE_PATHS], worktree);

    const outcome: TrialOutcome = {
      status: "completed",
      diff,
      changedFiles: names.split("\n").filter((line) => line !== ""),
      summary: attempt.summary,
      stop: attempt.stop,
      costUsd: attempt.costUsd,
      turns: attempt.turns,
      durationMs: attempt.durationMs,
    };

    await mkdir(RUNS_DIR, { recursive: true });
    await writeFile(cacheFile(key), JSON.stringify(outcome, null, 2));

    return outcome;
  } catch (error) {
    return { status: "unavailable", reason: describeFailure(error, undefined) };
  } finally {
    await git(["worktree", "remove", "--force", worktree]).catch(() => {});
    await git(["branch", "-D", branch]).catch(() => {});
  }
};

/**
 * Task ids with every trial stored for this agent, arm and model — every prompt,
 * every repetition — so `--reuse` can say what it will not re-run. A task
 * holding fewer stored trials than the run asks for is not listed: it still
 * spends the trials it is missing, and grading three samples where the metadata
 * claims five is the same false precision the cache key exists to prevent.
 */
export const cachedTaskIds = async (options: {
  readonly tasks: readonly EvalTask[];
  readonly agentId: string;
  readonly treatment: Treatment;
  readonly model: string;
  readonly effort: Effort | undefined;
  readonly repeat: number;
}): Promise<readonly string[]> => {
  const { tasks, agentId, treatment, model, effort, repeat } = options;

  const stored = new Set(await readdir(RUNS_DIR).catch(() => []));
  const isStored = (task: EvalTask, variant: number, repetition: number): boolean =>
    stored.has(
      `${cacheKey({ taskId: task.id, agentId, treatment, model, effort, variant, repetition })}.json`,
    );

  return tasks
    .filter((task) =>
      task.prompts.every((_, index) =>
        Array.from({ length: repeat }, (__, pass) => isStored(task, index + 1, pass + 1)).every(
          Boolean,
        ),
      ),
    )
    .map((task) => task.id);
};
