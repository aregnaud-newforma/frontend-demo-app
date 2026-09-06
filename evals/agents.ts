/**
 * The coding agent under test, behind one interface, so the suite can measure a
 * rule against something other than Claude.
 *
 * Everything below the CLI call is already agent-agnostic: the worktree, the
 * diff, the graders and the Langfuse reporting never ask who wrote the change.
 * Only three things do — the command and its result shape, where the agent
 * reads the rules from, and whether it takes a reasoning effort — and those are
 * what an `Agent` carries.
 *
 * The judge is deliberately not one of these. It is the instrument, not the
 * subject: a grader that changed with the agent would make no two runs
 * comparable, which is the same reason `JUDGE_MODEL` is pinned apart from the
 * subject's model.
 *
 * One file, one implementation, on purpose. A second agent splits it; a folder
 * of three files around a single adapter would be layering ahead of the need.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * The effort levels `claude --effort` accepts. A level a model does not support
 * falls back to the highest one below it, which the CLI does silently — so the
 * level recorded in a run's metadata is the one asked for, not necessarily the
 * one used.
 *
 * Named here rather than in the Claude adapter because the judge takes one too,
 * and the judge is not an agent.
 */
export const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;

export type Effort = (typeof EFFORTS)[number];

/**
 * Whether the agent chose to finish or `--max-turns` finished it. A cut-off
 * agent still left a diff, but never wrote its closing summary — the CLI kills
 * it before that message — so a grader that reads the summary must know the
 * silence is the budget's, not the agent's.
 */
export type AgentStop = "finished" | "max-turns";

export type AgentRequest = {
  readonly prompt: string;
  /** The worktree the agent runs in. It may write anything under it. */
  readonly cwd: string;
  readonly model: string;
  /** Undefined for a CLI that has no such setting — see `Agent.efforts`. */
  readonly effort: Effort | undefined;
  /** Undefined for a CLI with no turn cap — see `Agent.defaultMaxTurns`. */
  readonly maxTurns: number | undefined;
};

/**
 * What one invocation produced. `unavailable` is the harness, not the agent — a
 * rate limit, a timeout, a CLI that would not start — and it must never be
 * scored, because a zero from a trial that never ran is indistinguishable from
 * a skill that regressed.
 *
 * The three telemetry fields are `| undefined` rather than optional because not
 * every CLI reports them: Claude prints a dollar cost, others print tokens or
 * nothing. An adapter must therefore say it has no number, and a caller cannot
 * forget to. Zero would read as a free trial, which is a different claim.
 */
export type AgentRun =
  | {
      readonly status: "ran";
      readonly summary: string;
      readonly stop: AgentStop;
      readonly costUsd: number | undefined;
      readonly turns: number | undefined;
      readonly durationMs: number | undefined;
    }
  | { readonly status: "unavailable"; readonly reason: string };

export type Agent = {
  /** Its name on `--agent`, and a segment of the trial cache key. */
  readonly id: string;
  readonly defaultModel: string;
  /**
   * The levels this CLI accepts, out of the ones `EFFORTS` names. Empty when it
   * has no reasoning-effort setting at all. A level outside this list is an
   * error at the command line rather than a flag quietly dropped: a run whose
   * recorded effort was never applied is a run nobody can compare.
   */
  readonly efforts: readonly Effort[];
  readonly defaultEffort: Effort | undefined;
  /**
   * The turn budget this CLI takes, and undefined when it has none — the
   * timeout is then the only thing that stops a trial going in circles, and it
   * stops it after the money is spent. Declared like `efforts` and rejected
   * like it, for the same reason.
   */
  readonly defaultMaxTurns: number | undefined;
  /** Recorded per run: a CLI upgrade is an unrecorded variable otherwise. */
  readonly version: () => Promise<string>;
  /**
   * The variable that redirects this CLI's traffic, recorded per run beside its
   * version, and undefined for a CLI that documents no such variable. Named
   * rather than read here, because a base URL can carry a token and the
   * redaction to a bare host has to stay in one place — an adapter free to
   * return the URL itself is one adapter away from publishing a credential.
   */
  readonly apiBaseUrlEnv: string | undefined;
  /**
   * Removes the rules under test from the worktree, for the "without-skills"
   * arm. Each agent reads them from somewhere else, so each removes its own.
   */
  readonly stripRules: (worktree: string) => Promise<void>;
  readonly run: (request: AgentRequest) => Promise<AgentRun>;
};

const CLAUDE_TIMEOUT_MS = 15 * 60 * 1000;

type ClaudeResult = {
  readonly subtype?: string;
  readonly result?: string;
  readonly total_cost_usd?: number;
  readonly num_turns?: number;
  readonly duration_ms?: number;
};

/**
 * `claude -p` exits non-zero on any failure and writes execution failures to
 * stdout as the same JSON a success uses, so the exit code alone cannot tell an
 * agent that ran out of turns from a token that was rate-limited. `subtype` can.
 */
const resultOf = (error: unknown): ClaudeResult | undefined => {
  const stdout = (error as { stdout?: unknown } | null)?.stdout;
  if (typeof stdout !== "string") return undefined;
  try {
    return JSON.parse(stdout) as ClaudeResult;
  } catch {
    return undefined;
  }
};

/**
 * One line naming why a process failed. `execFile`'s own message repeats the
 * whole command line, prompt included, which is not a reason anyone reads.
 */
export const describeFailure = (error: unknown, timeoutMs: number | undefined): string => {
  if (!(error instanceof Error)) return String(error);
  const { killed, code, stderr } = error as Error & {
    killed?: boolean;
    code?: unknown;
    stderr?: string;
  };
  if (killed) {
    return timeoutMs === undefined ? "killed" : `killed after ${timeoutMs / 60_000} minutes`;
  }
  const line = stderr?.trim().split("\n")[0];
  if (typeof code === "number" || typeof code === "string") {
    return line ? `exit ${code}: ${line}` : `exit ${code}`;
  }
  return error.message;
};

/**
 * Shared by every agent: this repository keeps its rules in one place, so the
 * arm that removes them removes the same files whoever is reading them.
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
 * Pinned, because an unpinned model is a second thing changing under a score
 * meant to track one. The CLI's default follows the plan, the settings and the
 * account; a run from March and a run from June would then be different
 * experiments wearing the same name.
 *
 * Moved from `claude-fable-5-1` deliberately, and the line steps here: nothing
 * measured from now on is comparable to the eight trials that came before. Two
 * reasons. Opus 5 is half Fable 5.1's price ($5/$25 per MTok against $10/$50),
 * so a trial got cheaper rather than dearer. And a skill helps a weaker model
 * more, so the stronger model is the harder test — the one that says whether the
 * rule still earns its place.
 */
const CLAUDE_MODEL = "claude-opus-5";

/**
 * Pinned for the reason the model is. Unpinned, `claude -p` reads `effortLevel`
 * from the settings of whichever machine runs it, and a laptop and a CI runner
 * can disagree — a trial that thinks harder passes more often, and the
 * difference reads as a skill regression. `high` is Opus 5's own default, so
 * pinning it steps nothing.
 */
const CLAUDE_EFFORT: Effort = "high";

/**
 * Eighty, because the tasks a judge reads run `yarn verify` and `yarn test` and
 * were still hitting forty: the trial stopped at the budget, diff written and
 * summary never, and a judged task scores nothing from that. The same trials
 * finish inside eighty. The cap still exists to stop an agent going in circles.
 */
const CLAUDE_MAX_TURNS = 80;

const CLAUDE: Agent = {
  id: "claude",
  defaultModel: CLAUDE_MODEL,
  efforts: EFFORTS,
  defaultEffort: CLAUDE_EFFORT,
  defaultMaxTurns: CLAUDE_MAX_TURNS,

  version: () =>
    run("claude", ["--version"])
      .then(({ stdout }) => stdout.trim())
      .catch(() => "unknown"),

  apiBaseUrlEnv: "ANTHROPIC_BASE_URL",

  stripRules: stripSkills,

  run: async ({ prompt, cwd, model, effort, maxTurns }): Promise<AgentRun> => {
    let result: ClaudeResult;
    let stop: AgentStop = "finished";

    try {
      const { stdout } = await run(
        "claude",
        [
          "-p",
          prompt,
          "--model",
          model,
          ...(effort === undefined ? [] : ["--effort", effort]),
          "--permission-mode",
          "acceptEdits",
          ...(maxTurns === undefined ? [] : ["--max-turns", String(maxTurns)]),
          "--output-format",
          "json",
        ],
        { cwd, timeout: CLAUDE_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 },
      );
      result = JSON.parse(stdout) as ClaudeResult;
    } catch (error) {
      const failure = resultOf(error);
      // Out of turns is still a diff: whatever the agent left in the worktree
      // is what it wrote, and the diff graders read it as such. Anything else —
      // a rate limit, the timeout, a CLI that would not start — is no answer at
      // all.
      if (failure?.subtype !== "error_max_turns") {
        return {
          status: "unavailable",
          reason: failure?.result ?? describeFailure(error, CLAUDE_TIMEOUT_MS),
        };
      }
      result = failure;
      stop = "max-turns";
    }

    return {
      status: "ran",
      summary: result.result ?? "",
      stop,
      costUsd: result.total_cost_usd,
      turns: result.num_turns,
      durationMs: result.duration_ms,
    };
  },
};

/**
 * The Codex CLI, driven through `codex exec`. Written against the documented
 * flags and never run on the machine that added it: check `codex exec --help`
 * before trusting a score from it.
 *
 * Three things differ from Claude and each is visible below rather than papered
 * over — the reasoning effort is a config override and not a flag, there is no
 * turn budget at all, and the run reports tokens where Claude reports dollars.
 */
const CODEX_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Pinned like Claude's, and unverified: this is the model the suite intends to
 * measure, not one the harness has confirmed exists on your account. A wrong id
 * fails the trial rather than quietly measuring something else, which is the
 * behaviour to want from a pin.
 */
const CODEX_MODEL = "gpt-5.1-codex";

/**
 * Codex takes `minimal | low | medium | high`. Only the three that `EFFORTS`
 * also names are offered: "minimal" has no counterpart to compare against, and
 * `xhigh` and `max` are Claude's alone — asked for here they would be dropped
 * by the CLI and recorded by the run as though they had applied.
 */
const CODEX_EFFORTS: readonly Effort[] = ["low", "medium", "high"];

/** One line of `codex exec --json`. `turn.failed` is the run saying it did not finish. */
type CodexEvent = {
  readonly type?: string;
  readonly error?: { readonly message?: string };
};

const CODEX: Agent = {
  id: "codex",
  defaultModel: CODEX_MODEL,
  efforts: CODEX_EFFORTS,
  defaultEffort: "high",
  // No turn cap exists: `codex exec` runs until it is done or the timeout kills
  // it. `stop` is therefore always "finished", and a judged task can never be
  // unanswered here for want of a summary.
  defaultMaxTurns: undefined,

  apiBaseUrlEnv: "OPENAI_BASE_URL",

  version: () =>
    run("codex", ["--version"])
      .then(({ stdout }) => stdout.trim())
      .catch(() => "unknown"),

  stripRules: stripSkills,

  run: async ({ prompt, cwd, model, effort }): Promise<AgentRun> => {
    // The final message goes to a file rather than being dug out of the event
    // stream: with `--json` the stream is JSONL, and the assistant's last
    // message is one item among reasoning, commands and file changes.
    const scratch = await mkdtemp(join(tmpdir(), "eval-codex-"));
    const finalMessage = join(scratch, "final.md");

    try {
      const { stdout } = await run(
        "codex",
        [
          "exec",
          prompt,
          "--model",
          model,
          // Codex exposes no flag for this; `-c` is the documented route for a
          // config key, and the value parses as TOML or falls back to a string.
          ...(effort === undefined ? [] : ["-c", `model_reasoning_effort=${effort}`]),
          // The counterpart of Claude's `acceptEdits`. Without it the sandbox is
          // read-only and every trial produces an empty diff that grades as a
          // failed skill.
          "--sandbox",
          "workspace-write",
          "--json",
          "--output-last-message",
          finalMessage,
        ],
        { cwd, timeout: CODEX_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 },
      );

      // A failed turn can still exit zero, and its diff is whatever the agent
      // abandoned. That is no answer, and scoring it would publish a zero for
      // something the agent never had the chance to get wrong.
      const failure = stdout
        .split("\n")
        .filter((line) => line !== "")
        .map((line) => JSON.parse(line) as CodexEvent)
        .findLast((event) => event.type === "turn.failed");

      if (failure) {
        return { status: "unavailable", reason: failure.error?.message ?? "turn failed" };
      }

      return {
        status: "ran",
        summary: await readFile(finalMessage, "utf8").catch(() => ""),
        stop: "finished",
        // `turn.completed` carries token counts and no price. A dollar figure
        // here would be a pinned rate table wearing a measurement's name, and
        // it would land in the same score as Claude's metered one.
        costUsd: undefined,
        turns: undefined,
        durationMs: undefined,
      };
    } catch (error) {
      return { status: "unavailable", reason: describeFailure(error, CODEX_TIMEOUT_MS) };
    } finally {
      await rm(scratch, { recursive: true, force: true }).catch(() => {});
    }
  },
};

/**
 * The GitHub Copilot CLI, driven through `copilot -p`. Written against the
 * documented flags and never run on the machine that added it: check
 * `copilot help` before trusting a score from it.
 *
 * The caveat that matters is not a flag. Copilot does not read `.claude/skills`
 * — it reads `AGENTS.md`, `.github/copilot-instructions.md`,
 * `.github/instructions/**` and its own skills location — so `stripSkills`
 * removes files this agent was never reading, and the two arms differ today
 * only by the Skills section of `AGENTS.md`. A near-zero delta from this agent
 * is that gap, not a rule that fails to earn its place. Delivering the skills
 * where Copilot looks for them is what would make it measurable.
 */
const COPILOT_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Pinned like the others, and unverified. The documented examples are `gpt-5.4`,
 * `gpt-5.3-codex` and `claude-haiku-4.5`; `/model` in an interactive session is
 * the only authoritative list. Running this agent on a Claude model is the
 * interesting comparison — it changes the scaffold while holding the model,
 * which is the variable a harness comparison is actually about.
 */
const COPILOT_MODEL = "gpt-5.4";

const COPILOT: Agent = {
  id: "copilot",
  defaultModel: COPILOT_MODEL,
  /**
   * Empty, though the CLI does have the setting: `effortLevel` is a key in
   * `~/.copilot/settings.json`, not a flag, and the only way to set it per run
   * is to point `COPILOT_HOME` at a directory this harness writes. That
   * directory also holds the MCP config and the model key, so supplying one
   * would change more than the effort. Declared as unsupported until it can be
   * changed alone.
   */
  efforts: [],
  defaultEffort: undefined,
  // No turn cap exists, as with Codex: the timeout is the only bound.
  defaultMaxTurns: undefined,

  /**
   * Undefined: Copilot documents no base-URL override. Authentication is
   * `COPILOT_GITHUB_TOKEN`, `GH_TOKEN` or `GITHUB_TOKEN`, none of which names an
   * endpoint, and recording a token's variable is the one thing this field must
   * not do.
   */
  apiBaseUrlEnv: undefined,

  version: () =>
    run("copilot", ["--version"])
      .then(({ stdout }) => stdout.trim())
      .catch(() => "unknown"),

  stripRules: stripSkills,

  run: async ({ prompt, cwd, model }): Promise<AgentRun> => {
    try {
      const { stdout } = await run(
        "copilot",
        [
          "-p",
          prompt,
          "--model",
          model,
          // The counterpart of Claude's `acceptEdits` and Codex's
          // `workspace-write`. Paths are allowed as well as tools because the
          // worktree is a temporary directory outside the repository, and a
          // trial that may not write to it produces an empty diff that grades
          // as a failed skill. URLs are left alone: no task needs the network,
          // and `--yolo` would open all three at once.
          "--allow-all-tools",
          "--allow-all-paths",
          // A question asked in a non-interactive run is answered by nobody. It
          // would sit there until the timeout kills it, having spent the money.
          "--no-ask-user",
          // Suppresses the stats and decoration around the answer, leaving the
          // final message alone on stdout. It is also why the three telemetry
          // fields below are undefined: the stats it removes are unstructured,
          // and there is no JSON mode to ask for them back.
          "-s",
        ],
        { cwd, timeout: COPILOT_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 },
      );

      // The exit code is the only failure signal this CLI gives: no `subtype`
      // as Claude has, no `turn.failed` event as Codex has. A run that fails
      // partway and still exits zero is therefore scored as an answer — the one
      // known hole in this adapter, and it needs a structured output mode to
      // close.
      return {
        status: "ran",
        summary: stdout.trim(),
        stop: "finished",
        costUsd: undefined,
        turns: undefined,
        durationMs: undefined,
      };
    } catch (error) {
      return { status: "unavailable", reason: describeFailure(error, COPILOT_TIMEOUT_MS) };
    }
  },
};

export const AGENTS: readonly Agent[] = [CLAUDE, CODEX, COPILOT];

export const DEFAULT_AGENT = CLAUDE;

export const agentNamed = (id: string): Agent | undefined =>
  AGENTS.find((agent) => agent.id === id);
