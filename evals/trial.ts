import { execFile } from "node:child_process";
import { access, mkdir, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { EvalTask } from "./tasks.ts";

const run = promisify(execFile);

const REPO_ROOT = new URL("..", import.meta.url).pathname;
const RUNS_DIR = join(REPO_ROOT, "evals", ".runs");
const CLAUDE_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Pinned, because an unpinned model is a second thing changing under a score
 * meant to track one. The CLI's default follows the plan, the settings and the
 * account; a run from March and a run from June would then be different
 * experiments wearing the same name. This is the model the existing history was
 * produced on — change it deliberately, and expect the line to step when you do.
 */
export const DEFAULT_MODEL = "claude-fable-5-1";

/** Only source files are graded; a change to a config or a doc is not an answer. */
const SOURCE_PATHS = [":(glob)src/**/*.ts", ":(glob)src/**/*.tsx"];

/**
 * Which arm of the ablation a trial belongs to. "without-skills" answers the
 * question a pass alone cannot: whether the skill caused the pass, or the model
 * already knew the rule and the skill is decoration.
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
 * The final state of the environment after one attempt. `failed` is a real
 * result, not an exception: a trial that never edited anything scores zero like
 * any other wrong answer.
 */
export type TrialOutcome =
  | {
      readonly status: "completed";
      readonly diff: string;
      readonly changedFiles: readonly string[];
      readonly summary: string;
      readonly costUsd: number;
      readonly turns: number;
      readonly durationMs: number;
    }
  | { readonly status: "failed"; readonly reason: string }
  /** Not part of this run. Carries no score, so it cannot dent the pass rate. */
  | { readonly status: "skipped" };

type ClaudeResult = {
  readonly result?: string;
  readonly total_cost_usd?: number;
  readonly num_turns?: number;
  readonly duration_ms?: number;
};

const git = async (args: readonly string[], cwd = REPO_ROOT): Promise<string> => {
  const { stdout } = await run("git", [...args], { cwd, maxBuffer: 64 * 1024 * 1024 });
  return stdout;
};

/** Keyed by arm as well as task: the two arms are different measurements. */
const cacheFile = (taskId: string, arm: Arm): string => join(RUNS_DIR, `${taskId}.${arm}.json`);

const readCachedOutcome = async (taskId: string, arm: Arm): Promise<TrialOutcome | undefined> => {
  try {
    return JSON.parse(await readFile(cacheFile(taskId, arm), "utf8")) as TrialOutcome;
  } catch {
    return undefined;
  }
};

/**
 * Removes the rules under test from the worktree for the "without-skills" arm.
 *
 * `AGENTS.md`'s Skills section goes with the directory on purpose. Leaving it
 * would point the agent at files that no longer exist, and an agent that notices
 * a missing skill behaves differently from one that was never told skills exist
 * — two variables instead of one. For the same reason only `.claude/skills` is
 * removed: `.claude/settings.json` is empty today, but the day it holds a hook,
 * deleting it would change a second thing.
 */
const stripSkills = async (worktree: string): Promise<void> => {
  await rm(join(worktree, ".claude", "skills"), { recursive: true, force: true });

  const agentsPath = join(worktree, "AGENTS.md");
  const agents = await readFile(agentsPath, "utf8");
  await writeFile(agentsPath, agents.replace(/^## Skills\n[\s\S]*?(?=^## )/m, ""));
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
 * every trial starts from HEAD and cannot read another trial's history.
 */
export const runTrial = async (options: {
  readonly task: EvalTask;
  readonly arm: Arm;
  readonly model: string;
  readonly maxTurns: number;
  /** Reuse the stored outcome when one exists, instead of spending a trial. */
  readonly reuse: boolean;
}): Promise<TrialOutcome> => {
  const { task, arm, model, maxTurns, reuse } = options;

  if (reuse) {
    const cached = await readCachedOutcome(task.id, arm);
    if (cached) return cached;
  }

  const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const worktree = join("/tmp", `eval-${task.id}-${stamp}`);
  const branch = `eval/${task.id}-${stamp}`;

  await git(["worktree", "add", worktree, "-b", branch]);

  try {
    if (arm === "without-skills") await stripSkills(worktree);
    await linkDependencies(worktree);

    const { stdout } = await run(
      "claude",
      [
        "-p",
        promptFor(task),
        "--model",
        model,
        "--permission-mode",
        "acceptEdits",
        "--max-turns",
        String(maxTurns),
        "--output-format",
        "json",
      ],
      { cwd: worktree, timeout: CLAUDE_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 },
    );

    const claude = JSON.parse(stdout) as ClaudeResult;
    const diff = await git(["diff", "HEAD", "--", ...SOURCE_PATHS], worktree);
    const names = await git(["diff", "HEAD", "--name-only", "--", ...SOURCE_PATHS], worktree);

    const outcome: TrialOutcome = {
      status: "completed",
      diff,
      changedFiles: names.split("\n").filter((line) => line !== ""),
      summary: claude.result ?? "",
      costUsd: claude.total_cost_usd ?? 0,
      turns: claude.num_turns ?? 0,
      durationMs: claude.duration_ms ?? 0,
    };

    await mkdir(RUNS_DIR, { recursive: true });
    await writeFile(cacheFile(task.id, arm), JSON.stringify(outcome, null, 2));

    return outcome;
  } catch (error) {
    return { status: "failed", reason: error instanceof Error ? error.message : String(error) };
  } finally {
    await git(["worktree", "remove", "--force", worktree]).catch(() => {});
    await git(["branch", "-D", branch]).catch(() => {});
  }
};

/** Task ids with a stored outcome for this arm, so `--reuse` can say what it will not re-run. */
export const cachedTaskIds = async (arm: Arm): Promise<readonly string[]> => {
  const suffix = `.${arm}.json`;
  try {
    const files = await readdir(RUNS_DIR);
    return files.filter((f) => f.endsWith(suffix)).map((f) => f.slice(0, -suffix.length));
  } catch {
    return [];
  }
};
