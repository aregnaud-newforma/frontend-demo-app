/**
 * The diff a grader reads, for a trial and for a real pull request alike.
 *
 * One definition of "an answer" for both: `sourcePaths` in `evals.config.ts`
 * names what counts, and a grader that read a different slice of the tree
 * online than it does offline would score two things under one name.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "./config.ts";

const run = promisify(execFile);

/**
 * What the repository counts as an answer, as git pathspecs. Prefixed with
 * `:(glob)` because a bare pathspec reads a double star as a single one, so a
 * glob written to cross directories would match only one level down and quietly
 * grade a fraction of the change.
 */
export const SOURCE_PATHS: readonly string[] = config.sourcePaths.map((glob) => `:(glob)${glob}`);

export type SourceDiff = {
  readonly diff: string;
  readonly changedFiles: readonly string[];
};

/**
 * The source change over `range`, which is whatever `git diff` accepts: `HEAD`
 * for a worktree the agent just edited, `origin/main...HEAD` for a branch
 * against its merge base.
 */
export const sourceDiff = async (range: string, cwd: string): Promise<SourceDiff> => {
  const git = async (args: readonly string[]): Promise<string> => {
    const { stdout } = await run("git", [...args], { cwd, maxBuffer: 64 * 1024 * 1024 });
    return stdout;
  };
  const diff = await git(["diff", range, "--", ...SOURCE_PATHS]);
  const names = await git(["diff", range, "--name-only", "--", ...SOURCE_PATHS]);
  return { diff, changedFiles: names.split("\n").filter((line) => line !== "") };
};
