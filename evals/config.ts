/**
 * Everything the suite needs to know that is not true of every repository, in
 * one file the repository owns: `evals.config.ts` at its root, beside
 * `vite.config.ts` and `vitest.config.ts`.
 *
 * It holds two keys, and the shortness is the point. Arms, agents, models,
 * effort, repetition and concurrency are all command-line flags with a default
 * in the harness, and a key here beside a flag would be a second place a run's
 * conditions get decided — the half-wired failure `alias.ts` and tsconfig
 * `paths` warn about, where one of the two is updated and the other rots.
 *
 * There is no `--config`: the file is found by convention, because a suite that
 * can be pointed at two configs is a suite whose scores were produced under
 * conditions nobody can read off the run.
 */
import { execFile } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { addedCall, type EvalTask } from "./grading.ts";

const run = promisify(execFile);

export type EvalsConfig = {
  /** One per rule the repository wants gated. See `./grading.ts`. */
  readonly tasks: readonly EvalTask[];
  /**
   * What counts as an answer, as globs matched inside the trial worktree. Only
   * source files are graded; a change to a config or a doc is not an answer.
   *
   * Required, with no default: a default that missed this repository's sources
   * would leave every diff empty, and an empty diff scores 0 on every task —
   * a plausible, false number, which is the one thing this suite exists not to
   * produce.
   */
  readonly sourcePaths: readonly string[];
};

const CONFIG_FILE = "evals.config.ts";

const fail = (reason: string): never => {
  console.error(`${CONFIG_FILE}: ${reason}`);
  process.exit(1);
};

/**
 * Asked of git rather than derived from `import.meta.url`, which points at
 * wherever the harness itself was installed from — beside the repository today,
 * inside `node_modules` the day this is a package.
 */
export const repoRoot = (await run("git", ["rev-parse", "--show-toplevel"])).stdout.trim();

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

/**
 * Checked by hand and only at the surface, unlike the grader that comes back
 * from Langfuse: this file is part of the program `tsc` already compiles, so a
 * schema restating its type would be the second copy that goes stale. What is
 * worth checking is what a type cannot say — that the arrays hold something,
 * and that a pattern written for a diff grader is a pattern the grader can
 * compile at all rather than one that throws mid-run.
 */
const validated = (loaded: unknown): EvalsConfig => {
  const config = loaded as Partial<EvalsConfig> | undefined;

  if (config === undefined || typeof config !== "object") {
    return fail("no default export. Export the config as `export default { ... }`.");
  }
  if (!Array.isArray(config.tasks) || config.tasks.length === 0) {
    return fail("`tasks` is empty. A run with no task scores nothing.");
  }
  if (!isStringArray(config.sourcePaths) || config.sourcePaths.length === 0) {
    return fail("`sourcePaths` is empty. Every diff would be empty, and every task would score 0.");
  }

  for (const task of config.tasks) {
    if (task.grader.kind !== "diff") continue;
    try {
      addedCall(task.grader);
    } catch (error) {
      return fail(`task "${task.id}" has an unusable \`added\` pattern: ${String(error)}`);
    }
  }

  return config as EvalsConfig;
};

const configPath = join(repoRoot, CONFIG_FILE);

const loaded = await import(pathToFileURL(configPath).href).catch((error: unknown) =>
  fail(`could not be loaded from ${configPath}: ${String(error)}`),
);

export const config = validated((loaded as { default?: unknown }).default);
