import { execFile } from "node:child_process";
import { access, mkdir, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { describeFailure, type Agent, type AgentStop, type Effort } from "./agents.ts";
import { config, repoRoot } from "./config.ts";
import { gatesWithTasks, type EvalTask } from "./grading.ts";
import { installGate, installSkills, resolveSkills, type SkillSet } from "./skills.ts";
import { SOURCE_PATHS, sourceDiff } from "./diff.ts";

const run = promisify(execFile);

const RUNS_DIR = join(repoRoot, "evals", ".runs");

/**
 * Every gate this suite measures, installed into every worktree whatever the
 * trial is about. The set is constant on purpose: a task about `react` running
 * beside the other rules and one running alone are two environments, and the
 * difference would land inside the score of whichever ran second.
 *
 * The gates and no more, though the plugin ships other skills. An extra one is
 * not neutral — see `installSkills`.
 */
const GATES = gatesWithTasks(config.tasks);

/**
 * Which arm a trial belongs to. "without-skills" answers the question a pass
 * alone cannot: whether the skill caused the pass, or the model already knew the
 * rule and the skill is decoration. "previous-skill" answers a narrower one:
 * whether an edit to the skill moved anything, against the same code, harness,
 * CLI and hour — the one baseline last night's run cannot be.
 *
 * Comparable within one agent only. All three discover a skill the same way —
 * by its description, pulling the body in only once they commit to it — but
 * each scans directories it names itself, and the ones this repository fills
 * are Claude's, so what "with-skills" delivers is not the same treatment across
 * agents. The delta between the arms is the measurement that travels; the
 * absolute pass rate is not.
 */
export type Arm = "with-skills" | "without-skills" | "previous-skill";

/**
 * What "previous-skill" restores: one gate's rules as they were at a commit of
 * the skills repository, inside a worktree otherwise filled from the pin.
 * Carries the directory's tree hash because that, not the ref, is the
 * experiment: a branch moves while its rules stay put, so two refs holding the
 * same text are one baseline, and a ref whose text equals the pin's has nothing
 * to compare.
 */
export type Baseline = {
  /** As given on the command line, for the run metadata. */
  readonly ref: string;
  /** What it resolved to when the run started. */
  readonly commit: string;
  readonly gate: string;
  /** `git rev-parse <commit>:<pin.path>/<gate>`, in the skills repository. */
  readonly tree: string;
};

/**
 * The arm together with what it needs: the rules a trial is given, so no trial
 * has to resolve them for itself, and a baseline that "previous-skill" cannot be
 * asked for without and no other arm can be handed.
 *
 * `skills` rides here rather than being read inside `runTrial` because the cache
 * key is built before the worktree exists. A revision resolved later than that
 * would key a trial by rules it had not been given yet.
 */
export type Treatment =
  | { readonly arm: "with-skills" | "without-skills"; readonly skills: SkillSet }
  | { readonly arm: "previous-skill"; readonly skills: SkillSet; readonly baseline: Baseline };

/**
 * Appended when a task's checks policy is "skip". Harness instruction, not part
 * of the prompt under test: it is identical in every arm of a comparison, so it
 * cannot explain a difference between two runs.
 */
const SKIP_CHECKS = [
  "Scoped exercise: make the change and stop.",
  "Do not run this project's build, test, lint, end-to-end or dev-server commands.",
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
      /** See `Agent`: undefined is a CLI that cannot say, not a skill unused. */
      readonly skillsInvoked: readonly string[] | undefined;
    }
  | { readonly status: "unavailable"; readonly reason: string };

const git = async (args: readonly string[], cwd = repoRoot): Promise<string> => {
  const { stdout } = await run("git", [...args], { cwd, maxBuffer: 64 * 1024 * 1024 });
  return stdout;
};

/** A model id is free-form and ends up in a filename; a `/` in one is a lost run. */
const slug = (value: string): string => value.replaceAll(/[^\w.-]/g, "-");

/**
 * A baseline names a ref of the **skills** repository, not of this one. Both
 * halves of it are resolved there: a `--baseline-ref main` answered by this
 * repository's `main` would be a commit with no rules in it, resolved without
 * complaint.
 */
export const resolveBaseline = async (ref: string, gate: string): Promise<Baseline> => {
  const resolved = await resolveSkills([gate], ref);
  return { ref, gate, commit: resolved.commit, tree: resolved.tree };
};

/**
 * Where a coding agent looks for skills, across the three CLIs this suite runs:
 * `.claude/skills` is Claude's and Copilot's, `.agents/skills` is Codex's and
 * Copilot's, `.github/skills` is Copilot's alone.
 */
const SKILL_DIRS = [".claude/skills", ".github/skills", ".agents/skills"] as const;

/**
 * The arm that gets no rules. Nothing is installed into the worktree, so there
 * is in principle nothing to remove — the directories are emptied anyway,
 * because this repository does not own what an agent might find there and a
 * skill dropped into one of them by some other hand must not leak into the arm
 * that is meant to be without them. It costs nothing on a directory that is
 * already absent.
 *
 * `AGENTS.md`'s Skills section goes with them on purpose. Leaving it would point
 * the agent at files that do not exist, and an agent that notices a missing
 * skill behaves differently from one that was never told skills exist — two
 * variables instead of one. For the same reason only the skill directories go:
 * `.claude/settings.json` is empty at HEAD, but the day it holds a hook,
 * deleting it would change a second thing.
 */
const stripSkills = async (worktree: string): Promise<void> => {
  await Promise.all(
    SKILL_DIRS.map((dir) => rm(join(worktree, dir), { recursive: true, force: true })),
  );

  const agentsPath = join(worktree, "AGENTS.md");
  const agents = await readFile(agentsPath, "utf8");
  await writeFile(agentsPath, agents.replace(/^## Skills\n[\s\S]*?(?=^## )/m, ""));
};

/**
 * Only the gate's directory moves. The other skills and `AGENTS.md` stay at the
 * pinned revision in both arms of the comparison, which is what makes them
 * constants.
 */
const restoreSkill = async (worktree: string, baseline: Baseline): Promise<void> => {
  await installGate(worktree, baseline.gate, baseline.commit);
};

/**
 * The arm as it appears in a cache key. A "previous-skill" trial is keyed by
 * the text it was given, not the ref that named it: `--reuse` may serve a
 * trial of `main` to a run that said `HEAD~1` when the two hold the same rules,
 * and must not serve one to the other once `main` has moved.
 */
const armKey = (treatment: Treatment): string => {
  const rules = treatment.skills.tree.slice(0, 12);
  // "without-skills" carries no rule hash, and not as an oversight: no rules are
  // installed in that arm, so the revision is not one of its inputs. Keying it
  // by the pin would throw away the one arm worth caching — the control never
  // changes — every time a rule nobody ablated moved.
  switch (treatment.arm) {
    case "without-skills":
      return treatment.arm;
    case "with-skills":
      return `${treatment.arm}-${rules}`;
    case "previous-skill":
      return `${treatment.arm}-${rules}-${treatment.baseline.tree.slice(0, 12)}`;
  }
};

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
  const shared = join(repoRoot, "node_modules");
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
    // The rules go in before anything else reads the worktree, and the order
    // within is the experiment: every gate at the pin, then the one gate under
    // test moved back to its baseline.
    if (treatment.arm === "without-skills") await stripSkills(worktree);
    else await installSkills(worktree, GATES, treatment.skills.commit);
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

    // A file the agent created is untracked, and `git diff HEAD` does not list
    // untracked files: a new component, a new locale module or a new test would
    // grade as if it had never been written. Intent-to-add puts an empty entry
    // in the index so the diff shows the file whole, without staging content.
    await git(["add", "--intent-to-add", "--", ...SOURCE_PATHS], worktree);
    const { diff, changedFiles } = await sourceDiff("HEAD", worktree);

    const outcome: TrialOutcome = {
      status: "completed",
      diff,
      changedFiles,
      summary: attempt.summary,
      stop: attempt.stop,
      costUsd: attempt.costUsd,
      turns: attempt.turns,
      durationMs: attempt.durationMs,
      skillsInvoked: attempt.skillsInvoked,
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
