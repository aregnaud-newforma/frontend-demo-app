/**
 * The LLM judge: the grader for rules whose right answer leaves no signature a
 * regex can key on.
 *
 * `gradeAdded` in `grading.ts` reads the diff and counts calls. That works while a
 * rule is about an API. It runs out of road the moment two agents write the same
 * code for opposite reasons — which is exactly what `modern-set-operations`
 * produced: one agent checked the rule's `requires: ES2025` against this repo's
 * `lib` and declined the API on purpose, and an agent with no skills at all
 * writes the same `filter` out of ignorance. Identical diff, one score, nothing
 * to attribute. The evidence was in the agent's closing summary, and no grader
 * was reading it.
 *
 * So this grader reads the summary as well as the diff, and answers a question
 * stated in prose by the task.
 */
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { EFFORTS, type Effort } from "./agents.ts";

const run = promisify(execFile);

const JUDGE_TIMEOUT_MS = 3 * 60 * 1000;

/**
 * The default, for the same reason the subject's model is pinned and separately
 * from it: the judge is the instrument, not the subject. A judge that followed
 * the CLI's own default would silently change what "pass" means, and the change
 * would read as a skill regression on the chart.
 *
 * Per judge and not shared, unlike `JUDGE_EFFORT` above: a model id is a string
 * one CLI knows and another does not. What a judge model must be is the other
 * vendor from the *subject*, not from the other judge. Both judges read on
 * Sonnet today, because the default subject is `gpt-5.4`; this one exists for a
 * Claude subject, where the same model would be reading itself, and it is then
 * the Copilot judge that has to move.
 *
 * Sonnet rather than Haiku: the verdicts here turn on *why* the agent wrote what
 * it wrote, which is reading, not pattern matching. Sonnet rather than Opus: the
 * judge is about one percent of a run's cost, so buying the larger model
 * optimises the wrong line.
 */
const CLAUDE_JUDGE_MODEL = "claude-sonnet-5";

/**
 * One level for every judge, unlike the model below it, and it is the shared name
 * that says so: a reasoning effort is a dial each CLI exposes in the same units,
 * so two judges set to different ones would differ by how hard they thought as
 * well as by who they were — two variables in the one place this suite keeps to
 * one.
 *
 * High, like the subject's: a judge reads three thousand tokens and costs a cent,
 * so thinking less saves nothing that can be measured, while a verdict that flips
 * on a borderline diff moves a gate score in a way nobody can tell from a skill
 * regression. Consistency is what effort buys here.
 *
 * A judge whose CLI does not take one declares `efforts: []` and this is not
 * asked of it, the way an agent does — but both that exist take all five.
 */
const JUDGE_EFFORT: Effort = "high";

/**
 * What the judge is not allowed to be: an agent with a repository.
 *
 * Measured, because the default is startling. A plain `claude -p` question costs
 * **$0.59** and creates 148,068 tokens of cache — MCP servers, the built-in tool
 * definitions, the skills index — before it reads a single line of the diff. The
 * same question with these flags costs **$0.012** and loads about 3,000 tokens.
 * Fifty times the price for context a grader must not have anyway: a judge that
 * can read the repository could confirm a criterion the agent never satisfied.
 *
 * `--bare` would do more of this in one flag and cannot be used: it also skips
 * `--settings`, and on a developer machine that is where the credentials are, so
 * the judge answers "Not logged in". CI authenticates from the environment and
 * would not notice — a flag that works in one place and not the other is worse
 * than the four that work in both.
 */
const CLAUDE_ISOLATION_FLAGS = [
  // The judge answers from what it is handed. Nothing to run, nothing to read.
  "--tools",
  "",
  "--strict-mcp-config",
  "--mcp-config",
  '{"mcpServers":{}}',
  "--disable-slash-commands",
  "--exclude-dynamic-system-prompt-sections",
  "--no-chrome",
  // One turn: there is no tool to call and no second question to ask.
  "--max-turns",
  "1",
];

/** The final `result` event: what `--output-format json` returns whole. */
type ClaudeResult = { readonly result?: string };

/**
 * Everything one CLI needs to be handed to answer a criterion.
 *
 * `cwd` is a scratch directory the caller owns and deletes. A judge must run
 * somewhere that holds no `CLAUDE.md`, no `AGENTS.md` and no repository above
 * it, or the CLI hands it the very rules it is checking from the outside.
 */
export type JudgeRequest = {
  readonly payload: string;
  readonly system: string;
  readonly cwd: string;
  readonly model: string;
  /** Undefined for a CLI with no such setting — see `Judge.efforts`. */
  readonly effort: Effort | undefined;
};

/**
 * Who answers the criterion, behind one interface, so a judged gate can be run
 * on a machine that has no `claude` CLI — and so the one bias this suite cannot
 * see from inside can be measured: a Claude judge reading a Claude subject.
 *
 * A second, narrower interface than `Agent` on purpose, and not a reuse of it.
 * An agent is handed a repository and every tool; a judge must have neither, and
 * what buys that is per-CLI — the isolation flags, how a system prompt is
 * supplied at all, and the shape the answer comes back in. Those three are the
 * whole of what a `Judge` carries.
 *
 * Which judge ran is recorded in the run metadata beside its model, for the
 * reason the model already is: two models move in this system, and a grader that
 * varied unrecorded would make every score in the dataset unattributable —
 * including the scores of runs that did not change judge.
 */
export type Judge = {
  /** Its name on `--judge-agent`. */
  readonly id: string;
  readonly defaultModel: string;
  /** Empty when the CLI has no reasoning-effort setting. See `Agent.efforts`. */
  readonly efforts: readonly Effort[];
  readonly defaultEffort: Effort | undefined;
  /**
   * The verdict text, unparsed. Throws on failure rather than reporting one:
   * `judge` below turns anything thrown into `unavailable`, which is the one
   * result a grader may return without a score attached.
   */
  readonly ask: (request: JudgeRequest) => Promise<string>;
};

const SYSTEM_PROMPT = [
  "You grade one criterion against the work an AI coding agent did in a repository.",
  "",
  "You are given the criterion, the prompt the agent was asked, the diff it produced, and the summary it wrote when it finished.",
  "",
  "Rules:",
  "- Judge the criterion as written. Do not grade code quality, style, or anything the criterion does not name.",
  "- The summary is evidence. A criterion about *why* the agent did something is answered from what the agent said, not guessed from the diff.",
  "- Absence of evidence is a failure, not a pass. If the criterion asks for something you cannot see in the diff or the summary, it did not happen.",
  "- You cannot read the repository. Judge only from the text below.",
  "",
  'Reply with strict JSON and nothing else: {"passed": boolean, "reason": string}.',
  "Keep `reason` to one sentence naming the specific evidence you used. No prose outside the JSON, no code fences.",
].join("\n");

const CLAUDE_JUDGE = {
  id: "claude",
  defaultModel: CLAUDE_JUDGE_MODEL,
  efforts: EFFORTS,
  defaultEffort: JUDGE_EFFORT,

  ask: async ({ payload, system, cwd, model, effort }): Promise<string> => {
    const { stdout } = await run(
      "claude",
      [
        "-p",
        payload,
        "--model",
        model,
        ...(effort === undefined ? [] : ["--effort", effort]),
        "--system-prompt",
        system,
        "--output-format",
        "json",
        ...CLAUDE_ISOLATION_FLAGS,
      ],
      { cwd, timeout: JUDGE_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 },
    );

    return (JSON.parse(stdout) as ClaudeResult).result ?? "";
  },
} as const satisfies Judge;

/**
 * What the Copilot judge must not be, the same list the Claude one carries and
 * none of the same flags. Measured on the CLI rather than read off the docs,
 * which list barely a third of what `copilot --help` does.
 *
 * `--available-tools` is a whitelist, so a name matching no tool empties the
 * set: `none` is not a tool, and the model is left with zero. The flag has a
 * trap worth the word — passed with no value at all it is silently ignored, and
 * a probe that did so kept all 18 tools and 18,209 prompt tokens. With `none` it
 * loads 2,774, which is the difference between a grader and an agent.
 *
 * MCP servers configured in `~/.copilot/mcp-config.json` still connect; there is
 * no `--strict-mcp-config` here. They reach the model through tools, and there
 * are none, so the effect is the same and the cost is a few hundred tokens of
 * connection rather than a tool the judge could call.
 */
const COPILOT_ISOLATION_FLAGS = [
  // A whitelist emptied, not a blacklist filled. See above.
  "--available-tools",
  "none",
  // No AGENTS.md, no CLAUDE.md, no .github/copilot-instructions.md: a judge that
  // read this repository's rules would be checking them from the inside.
  "--no-custom-instructions",
  // The built-in github-mcp-server, which a grader has no use for and which
  // would let it read the repository the diff came from.
  "--disable-builtin-mcps",
  "--disallow-temp-dir",
  "--no-ask-user",
  // A CLI that updated itself mid-suite would be an unrecorded variable moving
  // under a score, which is the one thing the model pin exists to stop.
  "--no-auto-update",
  // JSONL, one event per line. `-s` is not passed with it: the format decides
  // the output whole, and the final message arrives as its own event.
  "--output-format",
  "json",
];

/**
 * Pinned, and the pin is the point rather than a formality: this is the default
 * judge and the default subject is Copilot on `gpt-5.4`, so a judge on the same
 * model would read its own writing and the bias `judge.ts` exists to keep
 * measurable would be invisible. Sonnet is the other vendor through the same
 * CLI, which is what lets the judge change without CI installing anything more.
 *
 * Sonnet rather than Opus for the reason `CLAUDE_JUDGE_MODEL` gives: the judge
 * reads, and it is a percent of a run. It happens to be Copilot's own default,
 * but that is not why it is here, and it stays pinned so a CLI that changes its
 * mind does not change what "pass" means.
 *
 * A run that puts `claude` under test with this judge is Claude reading Claude.
 * Pass `--judge-model gpt-5.4` for that run, or every verdict in it is suspect.
 */
const COPILOT_JUDGE_MODEL = "claude-sonnet-5";

/** One line of `copilot --output-format json`. */
type CopilotEvent = {
  readonly type?: string;
  readonly data?: { readonly content?: unknown };
};

const COPILOT_JUDGE = {
  id: "copilot",
  defaultModel: COPILOT_JUDGE_MODEL,
  /**
   * `--reasoning-effort` is a flag here, not the settings key `agents.ts` still
   * describes. It takes `none` and `minimal` as well, which `EFFORTS` does not
   * name: a level with no counterpart on the other judge is a level no two runs
   * could be compared across.
   */
  efforts: EFFORTS,
  defaultEffort: JUDGE_EFFORT,

  ask: async ({ payload, system, cwd, model, effort }): Promise<string> => {
    const { stdout } = await run(
      "copilot",
      [
        // The one thing this CLI cannot do: there is no system-prompt flag, so
        // the grading rules travel in the same channel as the diff and the
        // summary the agent under test wrote. `--no-custom-instructions` at
        // least leaves them the only instructions in the prompt, but a summary
        // that argues its own case is arguing against rules it sits beside
        // rather than under. It is the reason to prefer the Claude judge where
        // both are available, and the reason a Copilot verdict is worth reading
        // against a Claude one before it is trusted alone.
        "-p",
        `${system}\n\n${payload}`,
        "--model",
        model,
        ...(effort === undefined ? [] : ["--reasoning-effort", effort]),
        ...COPILOT_ISOLATION_FLAGS,
      ],
      { cwd, timeout: JUDGE_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 },
    );

    // The last `assistant.message`, and only that: the stream also carries
    // `reasoning` events whose `content` is the model thinking aloud, and a
    // grader that read one of those would parse a verdict out of deliberation.
    const answer = stdout
      .split("\n")
      .filter((line) => line.trim() !== "")
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as CopilotEvent];
        } catch {
          return [];
        }
      })
      .findLast((event) => event.type === "assistant.message")?.data?.content;

    if (typeof answer !== "string") {
      throw new Error("copilot returned no assistant message");
    }
    return answer;
  },
} as const satisfies Judge;

/**
 * `as const` for the reason `AGENTS` is: without it `id` widens to `string` and
 * `JudgeId` types nothing.
 *
 * Claude first, because it is the instrument this suite's history was measured
 * with and the only one that takes its rules as a system prompt. Copilot second
 * and the default, because the default subject is Copilot on `gpt-5.4` and this
 * judge reads it on Sonnet — the other vendor, which is the only way to see what
 * a model does when it grades itself.
 *
 * Codex is absent, and it is the mechanics rather than the principle: `codex
 * exec` has no system-prompt flag either, and unlike Copilot no verified
 * isolation to pair with it. Writing it unverified is the one thing to avoid
 * here — a subject adapter that is wrong fails its own trial visibly, while a
 * judge adapter that is wrong moves every score in the dataset quietly.
 */
export const JUDGES = [CLAUDE_JUDGE, COPILOT_JUDGE] as const satisfies readonly Judge[];

export type JudgeId = (typeof JUDGES)[number]["id"];

export const DEFAULT_JUDGE = COPILOT_JUDGE;

export const judgeNamed = (id: string): Judge | undefined =>
  JUDGES.find((candidate) => candidate.id === id);

/**
 * A verdict, or the honest absence of one.
 *
 * `unavailable` exists so a broken judge cannot look like a failed skill. A
 * grader that scores zero when it could not reach a model publishes a number
 * nobody can attribute, which is the failure this whole suite was built to stop
 * making.
 */
export type Verdict =
  | { readonly kind: "graded"; readonly passed: boolean; readonly reason: string }
  | { readonly kind: "unavailable"; readonly reason: string };

/**
 * What a judge's reply says, read as tolerantly as the reply allows.
 *
 * A model does things to JSON despite being told not to: a fence around it,
 * prose before or after it, or a literal newline inside the `reason` string,
 * which `JSON.parse` rejects and a model writing a paragraph produces. When the
 * whole does not parse, each boolean is read out of the text by its key, and
 * the reason is the `reason` string when it can be found and the whole reply
 * otherwise, so a reason that had to be read out of a broken reply is still
 * that reply.
 *
 * Both judges read through here: the one grading a trial and the one grading a
 * pull request. The first fix to this reading was made to one of two copies,
 * and the other kept the bug for a commit.
 */
type Reply = {
  readonly applies: boolean | undefined;
  readonly passed: boolean | undefined;
  readonly reason: string;
};

const readReply = (raw: string): Reply => {
  const unfenced = raw
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(unfenced) as {
      applies?: unknown;
      passed?: unknown;
      reason?: unknown;
    } | null;
    if (parsed !== null && typeof parsed === "object") {
      return {
        applies: typeof parsed.applies === "boolean" ? parsed.applies : undefined,
        passed: typeof parsed.passed === "boolean" ? parsed.passed : undefined,
        reason: typeof parsed.reason === "string" ? parsed.reason : "",
      };
    }
  } catch {
    // Not JSON as a whole; read each field out of the text below.
  }

  const flag = (key: string): boolean | undefined => {
    const match = new RegExp(`"${key}"\\s*:\\s*(true|false)`).exec(unfenced);
    return match === null ? undefined : match[1] === "true";
  };
  const reason = /"reason"\s*:\s*"([\s\S]*?)"\s*\}?\s*$/.exec(unfenced)?.[1];
  return { applies: flag("applies"), passed: flag("passed"), reason: reason ?? unfenced };
};

/**
 * A judge that says neither `true` nor `false` is unavailable, not failed, and
 * the reply travels whole in the reason so the next such failure can be read
 * rather than guessed at — the first one showed 200 characters and nothing else.
 *
 * Exported for its tests; nothing outside this file calls it.
 */
const verdictOf = (reply: Reply, raw: string): Verdict => {
  if (reply.passed === undefined) {
    return { kind: "unavailable", reason: `judge returned no verdict: ${raw.slice(0, 2000)}` };
  }
  return { kind: "graded", passed: reply.passed, reason: reply.reason };
};

export const parseVerdict = (raw: string): Verdict => verdictOf(readReply(raw), raw);

/**
 * Everything the judge sees. The criterion comes first because it is the
 * question; the diff and the summary are the evidence for it.
 */
const payload = (input: {
  readonly criterion: string;
  readonly prompt: string;
  readonly diff: string;
  readonly summary: string;
}): string =>
  [
    "## Criterion",
    input.criterion,
    "",
    "## The prompt the agent was given",
    input.prompt,
    "",
    "## The diff it produced",
    input.diff === "" ? "(no source change)" : input.diff,
    "",
    "## The summary it wrote",
    input.summary === "" ? "(no summary)" : input.summary,
  ].join("\n");

export const judge = async (input: {
  readonly criterion: string;
  readonly prompt: string;
  readonly diff: string;
  readonly summary: string;
  readonly judge: Judge;
  readonly model: string;
  readonly effort: Effort | undefined;
}): Promise<Verdict> => {
  // A scratch directory, so the CLI cannot find a CLAUDE.md above the judge and
  // hand it the very rules it is supposed to be checking from the outside.
  const cwd = await mkdtemp(join(tmpdir(), "eval-judge-"));

  try {
    return parseVerdict(
      await input.judge.ask({
        payload: payload(input),
        system: SYSTEM_PROMPT,
        cwd,
        model: input.model,
        effort: input.effort,
      }),
    );
  } catch (error) {
    return {
      kind: "unavailable",
      reason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await rm(cwd, { recursive: true, force: true }).catch(() => {});
  }
};

/**
 * The same judge, asked about a pull request nobody wrote a task for. Two
 * things differ from a trial, and both are in the prompt rather than the code.
 *
 * There is no summary: a pull request carries a title and a body, written for
 * a reviewer, and a criterion about *why* cannot be answered from those. So
 * the online criteria ask only what the diff shows.
 *
 * And silence is not failure here. A trial's diff is an answer to the prompt,
 * so a criterion it does not address is a criterion it failed. A pull request
 * is about whatever its author wanted, and most of them are about something
 * else: the judge says first whether the criterion applies, and a "no" is no
 * score at all rather than a pass that would inflate the line.
 */
const ONLINE_SYSTEM_PROMPT = [
  "You grade one criterion against the diff of a real pull request.",
  "",
  "You are given the criterion, the pull request's title and body, and its diff.",
  "",
  "Rules:",
  "- First decide whether the criterion applies: whether the diff contains the kind of change the criterion is about. Most pull requests are about something else, and for those `applies` is false and `passed` is ignored.",
  "- When it applies, judge the criterion as written. Do not grade code quality, style, or anything the criterion does not name.",
  "- Judge from the diff. The title and body say what the change is for; they are not evidence that the diff does it.",
  "- You cannot read the repository. Judge only from the text below.",
  "",
  'Reply with strict JSON and nothing else: {"applies": boolean, "passed": boolean, "reason": string}.',
  "Keep `reason` to one sentence naming the specific evidence you used. No prose outside the JSON, no code fences.",
].join("\n");

export type OnlineVerdict = Verdict | { readonly kind: "inapplicable"; readonly reason: string };

/** Exported for its tests; nothing outside this file calls it. */
export const parseOnlineVerdict = (raw: string): OnlineVerdict => {
  const reply = readReply(raw);
  if (reply.applies === false) return { kind: "inapplicable", reason: reply.reason };
  return verdictOf(reply, raw);
};

const onlinePayload = (input: {
  readonly criterion: string;
  readonly title: string;
  readonly body: string;
  readonly diff: string;
}): string =>
  [
    "## Criterion",
    input.criterion,
    "",
    "## The pull request",
    input.title === "" ? "(no title)" : input.title,
    "",
    input.body === "" ? "(no body)" : input.body,
    "",
    "## Its diff",
    input.diff,
  ].join("\n");

export const judgeOnline = async (input: {
  readonly criterion: string;
  readonly title: string;
  readonly body: string;
  readonly diff: string;
  readonly judge: Judge;
  readonly model: string;
  readonly effort: Effort | undefined;
}): Promise<OnlineVerdict> => {
  // A scratch directory, for the reason `judge` has one: the CLI must not find
  // the repository's own instructions above it.
  const cwd = await mkdtemp(join(tmpdir(), "eval-judge-"));

  try {
    return parseOnlineVerdict(
      await input.judge.ask({
        payload: onlinePayload(input),
        system: ONLINE_SYSTEM_PROMPT,
        cwd,
        model: input.model,
        effort: input.effort,
      }),
    );
  } catch (error) {
    return {
      kind: "unavailable",
      reason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await rm(cwd, { recursive: true, force: true }).catch(() => {});
  }
};
