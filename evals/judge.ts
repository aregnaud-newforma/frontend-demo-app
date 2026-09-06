/**
 * The LLM judge: the grader for rules whose right answer leaves no signature a
 * regex can key on.
 *
 * `gradeAdded` in `tasks.ts` reads the diff and counts calls. That works while a
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
import type { Effort } from "./agents.ts";

const run = promisify(execFile);

const JUDGE_TIMEOUT_MS = 3 * 60 * 1000;

/**
 * Pinned for the same reason the subject's model is, and separately from it: the
 * judge is the instrument, not the subject. A judge that follows the CLI's
 * default would silently change what "pass" means, and the change would read as
 * a skill regression on the chart.
 *
 * It stays Claude whichever agent is under test, for that same reason. Grading
 * Codex's diff with Codex would change the ruler and the thing being measured at
 * once, and no two runs of this suite would be comparable again.
 *
 * Sonnet rather than Haiku: the verdicts here turn on *why* the agent wrote what
 * it wrote, which is reading, not pattern matching. Sonnet rather than Opus: the
 * judge is about one percent of a run's cost, so buying the larger model
 * optimises the wrong line.
 */
export const JUDGE_MODEL = "claude-sonnet-5";

/**
 * Pinned like the judge's model, and high like the subject's: the judge reads
 * three thousand tokens and costs a cent, so thinking less saves nothing that
 * can be measured, while a verdict that flips on a borderline diff moves a gate
 * score in a way nobody can tell from a skill regression. Consistency is what
 * effort buys here.
 */
export const JUDGE_EFFORT: Effort = "high";

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
const ISOLATION_FLAGS = [
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

type ClaudeResult = { readonly result?: string };

/** Tolerates a model that wrapped its JSON in a fence despite being told not to. */
const parseVerdict = (raw: string): Verdict => {
  const json = raw
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { kind: "unavailable", reason: `judge did not return JSON: ${raw.slice(0, 200)}` };
  }

  const { passed, reason } = (parsed ?? {}) as { passed?: unknown; reason?: unknown };
  if (typeof passed !== "boolean") {
    return { kind: "unavailable", reason: `judge returned no verdict: ${json.slice(0, 200)}` };
  }

  return { kind: "graded", passed, reason: typeof reason === "string" ? reason : "" };
};

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
  readonly model: string;
  readonly effort: Effort;
}): Promise<Verdict> => {
  // A scratch directory, so the CLI cannot find a CLAUDE.md above the judge and
  // hand it the very rules it is supposed to be checking from the outside.
  const cwd = await mkdtemp(join(tmpdir(), "eval-judge-"));

  try {
    const { stdout } = await run(
      "claude",
      [
        "-p",
        payload(input),
        "--model",
        input.model,
        "--effort",
        input.effort,
        "--system-prompt",
        SYSTEM_PROMPT,
        "--output-format",
        "json",
        ...ISOLATION_FLAGS,
      ],
      { cwd, timeout: JUDGE_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 },
    );

    return parseVerdict((JSON.parse(stdout) as ClaudeResult).result ?? "");
  } catch (error) {
    return {
      kind: "unavailable",
      reason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await rm(cwd, { recursive: true, force: true }).catch(() => {});
  }
};
