import { execFile } from "node:child_process";
import { access, mkdir, readdir, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { describeFailure, type Agent, type AgentStop, type Effort } from "./agents.ts";
import type { EvalTask } from "./tasks.ts";

const run = promisify(execFile);

const REPO_ROOT = new URL("..", import.meta.url).pathname;
const RUNS_DIR = join(REPO_ROOT, "evals", ".runs");

/** Only source files are graded; a change to a config or a doc is not an answer. */
const SOURCE_PATHS = [":(glob)src/**/*.ts", ":(glob)src/**/*.tsx"];

/**
 * Which arm of the ablation a trial belongs to. "without-skills" answers the
 * question a pass alone cannot: whether the skill caused the pass, or the model
 * already knew the rule and the skill is decoration.
 *
 * Comparable within one agent only. Each agent reads its rules from a different
 * place and loads them differently — Claude pulls a skill in on demand, an agent
 * with only an `AGENTS.md` has the whole body in context from the first token —
 * so the two arms are not the same treatment across agents. The delta between
 * them is the measurement that travels; the absolute pass rate is not.
 */
export type Arm = "with-skills" | "without-skills";

/**
 * Appended when a task's checks policy is "skip". Harness instruction, not part
 * of the prompt under test: it is identical in every arm of a comparison, so it
 * cannot explain a difference between two runs.
 */
const SKIP_CHECKS = [
  "Scoped exercise: make the change and stop.",
  "Do not run `yarn verify`, `yarn test`, `yarn e2e` or `yarn dev`.",
].join(" ");

const promptFor = (task: EvalTask): string =>
  task.checks === "run" ? task.prompt : `${task.prompt}\n\n${SKIP_CHECKS}`;

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

/**
 * Keyed by agent, arm, model and effort as well as task, because all of them are
 * the measurement. Two arms are two experiments; so are two agents, two models,
 * and two effort levels. A cache keyed on the task alone would let `--reuse`
 * serve a Fable trial into a run whose metadata says Opus — a plausible number
 * that is false, which is the one failure mode this suite exists to stop making.
 *
 * The repetition index is in the key for a smaller version of the same reason:
 * repeated trials of one task are the samples the score averages, and a key
 * without it would let the second overwrite the first and leave `--reuse`
 * grading one sample as if it were several.
 */
const cacheKey = (options: {
  readonly taskId: string;
  readonly agentId: string;
  readonly arm: Arm;
  readonly model: string;
  readonly effort: Effort | undefined;
  readonly repetition: number;
}): string =>
  [
    options.taskId,
    options.agentId,
    options.arm,
    slug(options.model),
    options.effort ?? "no-effort",
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
  readonly arm: Arm;
  readonly model: string;
  readonly effort: Effort | undefined;
  /** Undefined for an agent with no turn cap; the timeout is then the budget. */
  readonly maxTurns: number | undefined;
  /** Which sample of this task this is, counting from 1. Part of the cache key. */
  readonly repetition: number;
  /** Reuse the stored outcome when one exists, instead of spending a trial. */
  readonly reuse: boolean;
}): Promise<TrialOutcome> => {
  const { task, agent, arm, model, effort, maxTurns, repetition, reuse } = options;

  const key = cacheKey({
    taskId: task.id,
    agentId: agent.id,
    arm,
    model,
    effort,
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
    if (arm === "without-skills") await agent.stripRules(worktree);
    await linkDependencies(worktree);

    const attempt = await agent.run({
      prompt: promptFor(task),
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
 * Task ids with every repetition stored for this agent, arm and model, so
 * `--reuse` can say what it will not re-run. A task holding fewer stored trials
 * than the run asks for is not listed: it still spends the trials it is missing,
 * and grading three samples where the metadata claims five is the same false
 * precision the cache key exists to prevent.
 */
export const cachedTaskIds = async (options: {
  readonly agentId: string;
  readonly arm: Arm;
  readonly model: string;
  readonly effort: Effort | undefined;
  readonly repeat: number;
}): Promise<readonly string[]> => {
  const { agentId, arm, model, effort, repeat } = options;

  const fileFor = (taskId: string, repetition: number): string =>
    `${cacheKey({ taskId, agentId, arm, model, effort, repetition })}.json`;

  // What every file of this run shares: the key with the task id and the
  // repetition taken off either end.
  const middle = fileFor("", 1).replace(/r1\.json$/, "r");

  try {
    const files = new Set(await readdir(RUNS_DIR));
    const ids = new Set(
      [...files]
        .filter((file) => file.endsWith(".json") && file.includes(middle))
        .map((file) => file.slice(0, file.lastIndexOf(middle))),
    );
    return [...ids].filter((id) =>
      Array.from({ length: repeat }, (_, index) => fileFor(id, index + 1)).every((file) =>
        files.has(file),
      ),
    );
  } catch {
    return [];
  }
};
