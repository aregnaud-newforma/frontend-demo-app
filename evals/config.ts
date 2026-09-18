/**
 * Everything the suite needs to know that is not true of every repository, in
 * one file the repository owns: `evals.config.ts` at its root, beside
 * `vite.config.ts` and `vitest.config.ts`.
 *
 * It holds seven keys, and the shortness is the point. Arms and repetition are
 * command-line flags with a default in the harness, and a key here beside one of
 * those would be a second place a run's conditions get decided — the half-wired
 * failure `alias.ts` and tsconfig `paths` warn about, where one of the two is
 * updated and the other rots.
 *
 * The other four are the exception, in two pairs that read as one sentence each:
 * `defaultAgent` and `agents` — who is under test, and what to ask of them —
 * then `defaultJudge` and `judges` for the instrument. Each earns its place
 * twice over. They are a chain rather than a second place: the flag wins, this
 * file is what a run means when the flag is absent, and the adapter's own pin is
 * what that means when this file is silent. One value, three sources in a fixed
 * order.
 *
 * And each of them is recorded in the run's own metadata — who ran, who graded,
 * on what model, at what effort. That is the test a key has to pass to live here:
 * a score must never depend on reading this file to know what produced it. An
 * unrecorded condition would fail it however convenient the key looked.
 *
 * `maxConcurrency` is the seventh, and it is not about the experiment at all: it
 * is how fast this machine may go, which is a property of the repository and its
 * quota rather than of what is being measured. It is recorded like the rest,
 * because a burst of rate-limited trials reads beside the concurrency that
 * caused it.
 *
 * There is no `--config`: the file is found by convention, because a suite that
 * can be pointed at two configs is a suite whose scores were produced under
 * conditions nobody can read off the run.
 */
import { execFile } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { AGENTS, agentNamed, type AgentId, type Effort } from "./agents.ts";
import { addedCall, type EvalTask } from "./grading.ts";
import { JUDGES, judgeNamed, type JudgeId } from "./judge.ts";

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
  /**
   * Who is under test when `--agent` is not given. Optional, and omitting it
   * leaves the harness default — a repository that measures the agent everyone
   * else does has nothing to say here, and saying it anyway would be a fixed
   * value copied into a second file.
   *
   * Set it when this repository's runs are normally about someone else. It
   * changes which CLI a bare `yarn evals` invokes, and with it the model, the
   * effort and the turn budget, which every agent carries its own.
   *
   * Typed as the agents that exist, so a typo is a type error naming them
   * rather than a run that failed to start. The check below is not redundant:
   * `evals.config.ts` is type-checked by `yarn verify`, and stripped of its
   * types by Node — a config edited without running `tsc` still reaches here.
   */
  readonly defaultAgent?: AgentId;
  /**
   * Who grades the judged tasks when `--judge-agent` is not given. Optional and
   * omitted for the reason `defaultAgent` is: a repository graded by the judge
   * the harness already defaults to has nothing to say here.
   *
   * Separate from `defaultAgent` and never derived from it. The judge is the
   * instrument and the agent is the subject, so a judge that followed whoever
   * was under test would move the ruler and the thing measured at once — and
   * it would do it silently, from a key nobody edited.
   *
   * Typed and re-checked exactly as `defaultAgent` is.
   */
  readonly defaultJudge?: JudgeId;
  /**
   * What each agent is asked for when `--model` and `--effort` are not given,
   * overriding the pin its adapter carries.
   *
   * Named for what it holds rather than for what it overrides: `agentDefaults`
   * beside `defaultAgent` was two keys one word apart meaning different things,
   * one naming who runs and one naming what to ask of them.
   *
   * Keyed by agent because a model id is a string one CLI knows and another has
   * never heard of: a flat `model` here would be handed to whoever ran. Keyed
   * ones are checked below against the agent they name, so `gpt-5.4` under
   * `claude` is an error before anything spawns rather than a failed trial.
   *
   * The pin in `agents.ts` is what this repository measured its history with.
   * Overriding it steps the line — nothing scored after is comparable to what
   * came before — which is a thing to do deliberately and not by inheriting a
   * config from elsewhere.
   */
  readonly agents?: Partial<Record<AgentId, RunDefaults>>;
  /** The same for the judges, and separate from `agents` for the reason `defaultJudge` is. */
  readonly judges?: Partial<Record<JudgeId, RunDefaults>>;
  /**
   * How many tasks run at once when `--max-concurrency` is not given.
   *
   * Not keyed by CLI, unlike `agents` above: this is what the machine and the
   * quota behind it can take, and a repository whose account tolerates three
   * abreast tolerates them whoever is running.
   *
   * The harness default is 1, because a trial is minutes and real money and
   * interleaved output is output nobody reads while it runs. Raise it here when
   * this repository's runs are normally unattended.
   */
  readonly maxConcurrency?: number;
  /**
   * Whether `online.ts` asks the judge, or runs the diff graders alone. Absent
   * means yes. Set it to `false` while the online criteria are new: each is
   * read against a handful of real diffs before its verdicts are trusted, and
   * that reading is a decision about this repository, reviewed in a pull
   * request, not a switch in a CI settings page. `--judge on|off` on the
   * command line still wins over it, and the judge that ran — or "none" — is
   * in the trace's metadata, which is the test a key here has to pass.
   */
  readonly onlineJudge?: boolean;
};

/**
 * What one CLI is asked for, overriding its adapter's pin and overridden in turn
 * by the flag. Both fields optional: a repository that wants a different effort
 * at the model it already runs should say that and nothing else.
 */
export type RunDefaults = {
  readonly model?: string;
  readonly effort?: Effort;
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
 * The run defaults, checked against the CLI each one names.
 *
 * Checked here and not in `run.ts` because the whole answer is here: an adapter
 * declares the efforts its CLI takes, so a level it does not is a mistake in
 * this file and the error should say so, before a worktree is cut or a token is
 * spent. The flag's counterpart in `run.ts` stays — a command line is strings,
 * and this one is typed.
 */
const validateDefaults = (
  key: "agents" | "judges",
  defaults: Partial<Record<string, RunDefaults>> | undefined,
  known: readonly { readonly id: string; readonly efforts: readonly Effort[] }[],
): void => {
  for (const [id, entry] of Object.entries(defaults ?? {})) {
    const cli = known.find((candidate) => candidate.id === id);
    if (cli === undefined) {
      const names = known.map((candidate) => candidate.id).join(", ");
      fail(`\`${key}\` names no such CLI: "${id}". Known: ${names}`);
      return;
    }
    if (entry?.model !== undefined && entry.model.trim() === "") {
      fail(`\`${key}.${id}.model\` is empty. Leave it out to keep the adapter's pin.`);
      return;
    }
    if (entry?.effort === undefined) continue;
    // Rejected rather than dropped, for the reason `--effort` is: an effort the
    // CLI never received, recorded in the metadata as though it had been, is a
    // run that cannot be compared to any other.
    if (cli.efforts.length === 0) {
      fail(`\`${key}.${id}.effort\` has no meaning for ${id}, which takes no reasoning effort.`);
      return;
    }
    if (!cli.efforts.includes(entry.effort)) {
      fail(
        `\`${key}.${id}.effort\` takes one of ${cli.efforts.join(", ")}, not "${entry.effort}".`,
      );
      return;
    }
  }
};

/**
 * What the config asks of one CLI, and nothing when it asks nothing. Indexed by
 * a plain string here so `run.ts` can hand over the id it resolved: the keys are
 * typed on the way in, which is where a typo is worth catching.
 */
export const configuredDefaults = (key: "agents" | "judges", id: string): RunDefaults =>
  (config[key] as Partial<Record<string, RunDefaults>> | undefined)?.[id] ?? {};

/**
 * Checked by hand and only at the surface, unlike the grader that comes back
 * from Langfuse: this file is part of the program `tsc` already compiles, so a
 * schema restating its type would be the second copy that goes stale. What is
 * worth checking is what a type cannot say — that the arrays hold something,
 * that a default names a CLI that exists, and that a pattern written for a diff
 * grader is a pattern the grader can compile at all rather than one that throws
 * mid-run.
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
  // Rejected rather than fallen back on, for the reason `--agent` is: a default
  // naming nobody would quietly run the suite against someone else and report
  // the score under this repository's name.
  if (config.defaultAgent !== undefined && agentNamed(config.defaultAgent) === undefined) {
    const known = AGENTS.map(({ id }) => id).join(", ");
    return fail(`\`defaultAgent\` names no agent: "${config.defaultAgent}". Known: ${known}`);
  }
  if (config.defaultJudge !== undefined && judgeNamed(config.defaultJudge) === undefined) {
    const known = JUDGES.map(({ id }) => id).join(", ");
    return fail(`\`defaultJudge\` names no judge: "${config.defaultJudge}". Known: ${known}`);
  }
  validateDefaults("agents", config.agents, AGENTS);
  validateDefaults("judges", config.judges, JUDGES);

  if (
    config.maxConcurrency !== undefined &&
    (!Number.isInteger(config.maxConcurrency) || config.maxConcurrency < 1)
  ) {
    return fail(
      `\`maxConcurrency\` takes a whole number of tasks at once, not "${String(config.maxConcurrency)}".`,
    );
  }

  if (config.onlineJudge !== undefined && typeof config.onlineJudge !== "boolean") {
    return fail(`\`onlineJudge\` is true or false, not "${String(config.onlineJudge)}".`);
  }

  for (const task of config.tasks) {
    if (task.grader.kind === "diff") {
      try {
        addedCall(task.grader);
      } catch (error) {
        return fail(`task "${task.id}" has an unusable \`added\` pattern: ${String(error)}`);
      }
    }
    if (task.online?.kind === "diff") {
      try {
        new RegExp(task.online.forbidden);
      } catch (error) {
        return fail(`task "${task.id}" has an unusable \`forbidden\` pattern: ${String(error)}`);
      }
    }
  }

  return config as EvalsConfig;
};

const configPath = join(repoRoot, CONFIG_FILE);

const loaded = await import(pathToFileURL(configPath).href).catch((error: unknown) =>
  fail(`could not be loaded from ${configPath}: ${String(error)}`),
);

export const config = validated((loaded as { default?: unknown }).default);
