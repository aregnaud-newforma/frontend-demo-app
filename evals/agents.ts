/**
 * The coding agent under test, behind one interface, so the suite can measure a
 * rule against something other than Claude.
 *
 * Everything below the CLI call is already agent-agnostic: the worktree, the
 * diff, the graders and the Langfuse reporting never ask who wrote the change.
 * Only two things do — the command and its result shape, and whether it takes a
 * reasoning effort — and those are what an `Agent` carries. Removing the rules
 * is not one of them: every agent discovers skills from a directory, so the
 * "without-skills" arm removes directories and never asks who is reading.
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
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
      /**
       * The skills the agent loaded, by the name the tool takes — so a gate can
       * ask whether its own rules were read at all. Undefined for a CLI that
       * reports no tool calls, and undefined rather than empty for the reason
       * the telemetry above is: "it loaded none" and "this agent cannot say"
       * are different claims, and only one of them is evidence.
       */
      readonly skillsInvoked: readonly string[] | undefined;
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
  readonly run: (request: AgentRequest) => Promise<AgentRun>;
};

const CLAUDE_TIMEOUT_MS = 15 * 60 * 1000;

/** The final `result` event: what `--output-format json` returns whole. */
type ClaudeResult = {
  readonly subtype?: string;
  readonly result?: string;
  readonly total_cost_usd?: number;
  readonly num_turns?: number;
  readonly duration_ms?: number;
};

/** One block of an assistant message. Only `tool_use` is read. */
type ClaudeBlock = {
  readonly type?: string;
  readonly name?: string;
  readonly input?: { readonly skill?: unknown };
};

/** One line of the stream: the events above arrive tagged, one per line. */
type ClaudeEvent = ClaudeResult & {
  readonly type?: string;
  readonly message?: { readonly content?: readonly ClaudeBlock[] };
};

/**
 * The tool that loads a skill. Its `skill` argument is the directory name under
 * `.claude/skills`, which is also what a task calls its `gate` — so an
 * invocation is comparable to a gate with nothing translating between the two.
 */
const SKILL_TOOL = "Skill";

/**
 * What one run left on stdout: the summary and the telemetry, and which skills
 * the agent reached for on its way there.
 *
 * The second is why this adapter reads a stream rather than the single JSON
 * object `--output-format json` returns. A gate score that moves is otherwise
 * two hypotheses in one number — the rule stopped working, or the agent never
 * loaded it — and the evidence sat in tool calls nobody was reading. It costs
 * no tokens: the format decides what the CLI prints locally, not what is sent.
 */
type ClaudeTranscript = {
  readonly result: ClaudeResult | undefined;
  /** Deduplicated: a skill loaded twice is one skill loaded. */
  readonly skillsInvoked: readonly string[];
};

const parseTranscript = (stdout: string): ClaudeTranscript => {
  const skills: string[] = [];
  let result: ClaudeResult | undefined;

  for (const line of stdout.split("\n")) {
    if (line.trim() === "") continue;

    let event: ClaudeEvent;
    try {
      event = JSON.parse(line) as ClaudeEvent;
    } catch {
      // A line the CLI wrote that is not an event is not a reason to lose the
      // trial: the diff is already on disk and the rest of the stream still
      // holds the summary.
      continue;
    }

    if (event.type === "result") result = event;
    if (event.type !== "assistant") continue;

    for (const block of event.message?.content ?? []) {
      if (block.type !== "tool_use" || block.name !== SKILL_TOOL) continue;
      if (typeof block.input?.skill === "string") skills.push(block.input.skill);
    }
  }

  return { result, skillsInvoked: [...new Set(skills)] };
};

/**
 * `claude -p` exits non-zero on any failure and writes execution failures to
 * stdout as the same events a success uses, so the exit code alone cannot tell
 * an agent that ran out of turns from a token that was rate-limited. The
 * `result` event's `subtype` can — and the stream up to it still names the
 * skills a cut-off agent had already loaded.
 */
const transcriptOf = (error: unknown): ClaudeTranscript | undefined => {
  const stdout = (error as { stdout?: unknown } | null)?.stdout;
  return typeof stdout === "string" ? parseTranscript(stdout) : undefined;
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

  run: async ({ prompt, cwd, model, effort, maxTurns }): Promise<AgentRun> => {
    let transcript: ClaudeTranscript;
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
          // The stream, not the single object: it carries the same `result` at
          // the end and the tool calls before it. `--verbose` is not optional —
          // `-p` refuses `stream-json` without it.
          "--output-format",
          "stream-json",
          "--verbose",
        ],
        { cwd, timeout: CLAUDE_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 },
      );
      transcript = parseTranscript(stdout);
    } catch (error) {
      const failure = transcriptOf(error);
      // Out of turns is still a diff: whatever the agent left in the worktree
      // is what it wrote, and the diff graders read it as such. Anything else —
      // a rate limit, the timeout, a CLI that would not start — is no answer at
      // all.
      if (failure?.result?.subtype !== "error_max_turns") {
        return {
          status: "unavailable",
          reason: failure?.result?.result ?? describeFailure(error, CLAUDE_TIMEOUT_MS),
        };
      }
      transcript = failure;
      stop = "max-turns";
    }

    return {
      status: "ran",
      summary: transcript.result?.result ?? "",
      stop,
      costUsd: transcript.result?.total_cost_usd,
      turns: transcript.result?.num_turns,
      durationMs: transcript.result?.duration_ms,
      skillsInvoked: transcript.skillsInvoked,
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
        // Not read from the stream yet. Codex does load skills on demand, so
        // the question Claude's `Skill` calls answer can be asked of it — but
        // it scans `.agents/skills`, and this repository keeps its rules in
        // `.claude/skills`, which Codex never looks at. Until a worktree links
        // one at the other, both arms of a Codex run are without-skills runs
        // that differ only by the Skills section of `AGENTS.md`, and a delta
        // from this agent measures that section alone.
        skillsInvoked: undefined,
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
 * Copilot scans `.github/skills`, `.claude/skills` and `.agents/skills`, so
 * this repository's rules reach it where they already sit and both arms are a
 * real comparison. What it will not report is which of them it loaded: the
 * choice is description-driven as Claude's is, but `-s` leaves only the final
 * message on stdout and there is no structured mode to ask the tool calls back
 * from.
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
        // Blocked on the same thing the failure signal above is: `-s` leaves
        // the final message alone on stdout, and there is no structured mode
        // to ask the tool calls back from.
        skillsInvoked: undefined,
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
