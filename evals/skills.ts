/**
 * The rules under test, which this repository no longer owns.
 *
 * They used to be `.claude/skills/<gate>` here, and a trial got them for free:
 * the worktree was a checkout of HEAD, so the rules came with the code. They are
 * now a Claude plugin published from another repository, and a worktree cut from
 * this one holds none of them.
 *
 * Nothing about that is visible from inside a trial, which is what makes it
 * dangerous rather than merely broken. The plugin is installed against a project
 * path and enabled by that project's settings, so an agent running in
 * `/tmp/eval-…` silently has no rules — and a `with-skills` arm measuring an
 * agent with no rules scores like the arm that removed them, which reads as a
 * skill that does nothing. That is the plausible, false number the whole suite
 * exists to refuse.
 *
 * So the harness stops inheriting the rules and starts installing them: a
 * worktree is filled from a pinned revision, and the revision is recorded beside
 * the score. A trial then holds everything the agent read, which is what makes
 * it a measurement rather than an anecdote.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { repoRoot } from "./config.ts";
import { pin } from "./pin.ts";

const run = promisify(execFile);

/**
 * Where the clone lives. Inside `evals/` beside `.runs` and ignored like it: a
 * checkout of another repository is build output, not source.
 */
const CACHE_DIR = join(repoRoot, "evals", ".skills");

/**
 * What one revision of the rules is, to a run: a commit to report and a hash of
 * the text actually installed, which is what a cache key can trust. Two refs
 * naming one text are one experiment, and a ref that moved without changing a
 * rule is not a reason to spend the trials again.
 */
export type SkillSet = {
  readonly ref: string;
  readonly commit: string;
  readonly tree: string;
};

const exists = async (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  );

const git = async (args: readonly string[], cwd: string): Promise<string> => {
  const { stdout } = await run("git", [...args], { cwd, maxBuffer: 64 * 1024 * 1024 });
  return stdout;
};

let checkout: Promise<string> | undefined;

/**
 * The clone this harness reads, made once and kept.
 *
 * `EVALS_SKILLS_DIR` first, which is how CI hands over the checkout it made with
 * its deploy key. Otherwise the harness clones for itself.
 *
 * Deliberately *not* the marketplace clone `claude plugin` leaves in
 * `~/.claude/plugins`, tempting as it is. That one is shallow — one commit,
 * measured — so it can serve neither a pin other than its tip nor any baseline
 * at all; it is fetched and moved by the CLI, so it could change under a run
 * that takes ninety minutes; and it is where a rule is authored, so it may hold
 * uncommitted edits. Every one of those produces a score labelled with a
 * revision it was not measured at.
 *
 * Failure throws rather than returning a path that is not a clone: the
 * alternative is a worktree with no rules in it, which scores 0 on every task
 * and looks exactly like a skill that stopped working.
 */
export const skillsCheckout = async (): Promise<string> => {
  checkout ??= (async () => {
    const fromEnv = process.env.EVALS_SKILLS_DIR;
    if (fromEnv !== undefined) return fromEnv;

    if (!(await exists(join(CACHE_DIR, ".git")))) {
      // Full history, not a shallow clone: a baseline reaches for a commit older
      // than the pin, and a shallow clone refuses it with an error nobody would
      // connect back to this line.
      await run("git", ["clone", pin.url, CACHE_DIR], { cwd: repoRoot });
      return CACHE_DIR;
    }

    // Fetched every run, because the pin names a branch as often as a commit and
    // a stale clone would measure last week's rules under this week's name.
    await git(["fetch", "--prune", "origin"], CACHE_DIR);
    return CACHE_DIR;
  })();

  return checkout;
};

/**
 * One gate's rules at a revision, as a tree hash. A missing gate throws here
 * rather than installing nothing: a gate this repository names and the skills
 * repository does not is a broken pin, not an empty measurement.
 */
const gateTree = async (gate: string, revision: string): Promise<string> =>
  (await git(["rev-parse", `${revision}:${pin.path}/${gate}`], await skillsCheckout())).trim();

/**
 * What a run installs, resolved once before any trial. The hash covers every
 * gate's text and nothing else, so a change to a skill this suite does not
 * measure cannot invalidate a cache, and a change to one it does cannot be
 * served from one.
 */
export const resolveSkills = async (
  gates: readonly string[],
  ref: string = pin.ref,
): Promise<SkillSet> => {
  const dir = await skillsCheckout();
  // `origin/<ref>` first: a fetched branch has no local head in a clone this
  // harness never checks out, and `rev-parse main` there would fail.
  const commit = (
    await git(["rev-parse", `origin/${ref}^{commit}`], dir).catch(() =>
      git(["rev-parse", `${ref}^{commit}`], dir),
    )
  ).trim();

  const trees = await Promise.all(
    [...gates].sort().map(async (gate) => `${gate}:${await gateTree(gate, commit)}`),
  );

  return {
    ref,
    commit,
    tree: createHash("sha256").update(trees.join("\n")).digest("hex"),
  };
};

/**
 * Copies one path of the skills repository, at one revision, into a directory.
 *
 * `git archive` rather than a checkout: it reads a revision without touching the
 * clone's own working tree, so nothing uncommitted can leak into a measurement.
 * The tree-ish form `<rev>:<path>` is what keeps the entries unprefixed — the
 * two-argument form emits them under the full path, and extracting that into
 * `.claude/skills` would bury every rule three directories deep where no agent
 * looks and no error is raised.
 */
const extract = async (revision: string, path: string, target: string): Promise<void> => {
  await mkdir(target, { recursive: true });

  const { stdout } = await run(
    "git",
    ["-C", await skillsCheckout(), "archive", `${revision}:${path}`],
    { encoding: "buffer", maxBuffer: 256 * 1024 * 1024 },
  );

  const untar = run("tar", ["-x", "-C", target]);
  untar.child.stdin?.end(stdout);
  await untar;
};

/**
 * Fills a worktree's `.claude/skills` with the gates this suite measures.
 *
 * The gates and nothing else, though the plugin ships more. An extra skill is
 * not neutral: `react-native` describes itself in terms of re-renders and
 * performance, which is what three of the `react` gate's tasks are about, and an
 * agent that reaches for it instead scores the gate at zero while behaving
 * perfectly sensibly. That is a variable this suite never had when the rules
 * were its own directory, and adding it here would land inside the same number
 * as the move itself.
 */
export const installSkills = async (
  worktree: string,
  gates: readonly string[],
  revision: string,
): Promise<void> => {
  for (const gate of gates) {
    await extract(revision, `${pin.path}/${gate}`, join(worktree, ".claude", "skills", gate));
  }
};

/**
 * Replaces one gate's rules with another revision's, leaving every other skill
 * at the pinned one. What `--arm previous-skill` is: one variable moved, and
 * everything around it held.
 */
export const installGate = async (
  worktree: string,
  gate: string,
  revision: string,
): Promise<void> => {
  const target = join(worktree, ".claude", "skills", gate);
  // Removed first: extracting over a directory keeps whatever the new revision
  // no longer has, and a reference file deleted upstream would survive into the
  // baseline and be measured as though the baseline still carried it.
  await rm(target, { recursive: true, force: true });
  await extract(revision, `${pin.path}/${gate}`, target);
};
