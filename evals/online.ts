/**
 * Entry point for the online tier: scores one real change — a pull request, a
 * branch — against every rule that has an online grader, and reports it to
 * Langfuse as one trace tagged `online`.
 *
 * Usage: yarn evals:online --base <ref> [--pr <n>] [--title <text>] [--body-file <path>]
 *                          [--judge on|off] [--judge-agent <id>] [--judge-model <id>]
 *                          [--judge-effort <level>]
 *
 * `run.ts` asks "is the rule well written": it gives an agent an exercise and
 * grades the answer. This asks "do the agents people actually use follow it":
 * nobody wrote an exercise, the diff is whatever the author wanted, and the
 * same graders read it. So there is no dataset and no run here. A dataset
 * item is a task, and this diff answers none; the trace stands on its own,
 * and the `<family>_gate` names it carries are the ones `run.ts` writes, so
 * the two tiers meet in the Scores view under one name.
 *
 * Report-only by design. The exit code says whether the harness measured —
 * a judge that could not answer exits non-zero, as it does in `run.ts` — and
 * never what it measured: a pull request that fails every gate exits zero,
 * because a score is an answer and blocking on it is a decision for later,
 * once the online criteria have been read against enough real diffs.
 */
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { parseArgs, promisify } from "node:util";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseClient } from "@langfuse/client";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { propagateAttributes, startActiveObservation } from "@langfuse/tracing";
import { config, configuredDefaults, repoRoot } from "./config.ts";
import { sourceDiff } from "./diff.ts";
import { gradeAdded, scoreName, type EvalTask, type OnlineGrader } from "./grading.ts";
import { judgeOnline, judgeNamed, DEFAULT_JUDGE, JUDGES, type OnlineVerdict } from "./judge.ts";
import { writeReport, type RuleVerdict } from "./report.ts";
import type { Effort } from "./agents.ts";

const run = promisify(execFile);

const { values } = parseArgs({
  options: {
    base: { type: "string" },
    pr: { type: "string" },
    title: { type: "string", default: "" },
    "body-file": { type: "string" },
    // No default: the flag wins, then `onlineJudge` in `evals.config.ts`, then
    // yes — the chain every other condition of a run follows.
    judge: { type: "string" },
    // No defaults, for the reason `run.ts` gives: they belong to whichever
    // judge `--judge-agent` names.
    "judge-agent": { type: "string" },
    "judge-model": { type: "string" },
    "judge-effort": { type: "string" },
    // Print the source files the diff touches and stop, before Langfuse or a
    // judge is reached: CI asks this first, and skips the scoring job when
    // there is nothing to score.
    "list-files": { type: "boolean", default: false },
    // Where to write the report as data, for the pull request comment.
    "report-file": { type: "string" },
  },
});

if (values.base === undefined) {
  console.error("--base is required: the ref the change is measured against, e.g. origin/main.");
  process.exit(1);
}
const base = values.base;

const pr = values.pr === undefined ? undefined : Number(values.pr);
if (pr !== undefined && (!Number.isInteger(pr) || pr < 1)) {
  console.error(`--pr takes a pull request number, not "${values.pr}".`);
  process.exit(1);
}

const body = values["body-file"] === undefined ? "" : await readFile(values["body-file"], "utf8");

/**
 * Whether the judge runs. Off, the diff graders still do: free, instant, and
 * enough while the online criteria are being read against real diffs before
 * their verdicts are trusted.
 */
if (values.judge !== undefined && values.judge !== "on" && values.judge !== "off") {
  console.error(`--judge takes on or off, not "${values.judge}".`);
  process.exit(1);
}
const withJudge = values.judge === undefined ? (config.onlineJudge ?? true) : values.judge === "on";

/**
 * The judge, resolved as `run.ts` resolves it: the flag, then
 * `evals.config.ts`, then the harness's own. Only the flag can still be wrong.
 */
const judgeAgentId = values["judge-agent"] ?? config.defaultJudge ?? DEFAULT_JUDGE.id;
const judgeAgent = judgeNamed(judgeAgentId);
if (judgeAgent === undefined) {
  console.error(
    `No judge named "${judgeAgentId}". Known: ${JUDGES.map(({ id }) => id).join(", ")}`,
  );
  process.exit(1);
}
const configuredJudge = configuredDefaults("judges", judgeAgent.id);
const judgeModel = values["judge-model"] ?? configuredJudge.model ?? judgeAgent.defaultModel;

if (values["judge-effort"] !== undefined && judgeAgent.efforts.length === 0) {
  console.error(
    `--judge-effort has no meaning for ${judgeAgent.id}, which takes no reasoning effort.`,
  );
  process.exit(1);
}
const judgeEffort: Effort | undefined =
  values["judge-effort"] === undefined
    ? (configuredJudge.effort ?? judgeAgent.defaultEffort)
    : judgeAgent.efforts.find((candidate) => candidate === values["judge-effort"]);
if (values["judge-effort"] !== undefined && judgeEffort === undefined) {
  console.error(
    `--judge-effort takes one of ${judgeAgent.efforts.join(", ")}, not "${values["judge-effort"]}".`,
  );
  process.exit(1);
}

const git = async (args: readonly string[]): Promise<string> => {
  const { stdout } = await run("git", [...args], { cwd: repoRoot });
  return stdout.trim();
};

// Three dots: the change since the branch left `base`, not the distance
// between two tips. A base that moved on since the branch was cut would
// otherwise read as part of the pull request.
const range = `${base}...HEAD`;
const { diff, changedFiles } = await sourceDiff(range, repoRoot);

if (values["list-files"]) {
  for (const file of changedFiles) console.log(file);
  process.exit(0);
}

const headSha = await git(["rev-parse", "HEAD"]);
const baseSha = await git(["merge-base", base, "HEAD"]);
const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"]);

/**
 * Which coding agents signed the commits, read from the trailers they write
 * and the accounts they push under. Recorded, never used to decide whether to
 * score: every change is scored, and attribution is a filter in Langfuse —
 * agent-written against hand-written under the same gate is the comparison
 * this tier exists to draw.
 */
const attribution = async (): Promise<readonly string[]> => {
  const log = await git(["log", "--format=%an%n%ae%n%b", `${baseSha}..HEAD`]);
  const found = new Set<string>();
  if (/copilot/i.test(log)) found.add("copilot");
  if (/claude/i.test(log)) found.add("claude");
  if (/codex|openai/i.test(log)) found.add("codex");
  return [...found].toSorted();
};

const agents = await attribution();

if (diff.trim() === "") {
  console.log(`No source change between ${base} and HEAD: nothing to grade.`);
  process.exit(0);
}

const graded = config.tasks.filter(
  (task): task is EvalTask & { readonly online: OnlineGrader } => task.online !== undefined,
);

type Outcome =
  | { readonly task: EvalTask; readonly verdict: OnlineVerdict }
  | { readonly task: EvalTask; readonly verdict: { readonly kind: "skipped" } };

const grade = async (task: EvalTask & { readonly online: OnlineGrader }): Promise<Outcome> => {
  if (task.online.kind === "diff") {
    // The task's own diff grader, with the online signature in place of its
    // pattern and "none" in place of its expectation: what a pull request must
    // not add, counted on the lines it adds.
    const counted = gradeAdded(diff, {
      kind: "diff",
      family: task.grader.family,
      expect: "none",
      added: task.online.forbidden,
    });
    return { task, verdict: { kind: "graded", passed: counted.passed, reason: counted.comment } };
  }
  if (!withJudge) return { task, verdict: { kind: "skipped" } };
  const verdict = await judgeOnline({
    criterion: task.online.criterion,
    title: values.title,
    body,
    diff,
    judge: judgeAgent,
    model: judgeModel,
    effort: judgeEffort,
  });
  return { task, verdict };
};

// Serial: the judged ones share one CLI quota, and there are a handful.
const outcomes: Outcome[] = [];
for (const task of graded) {
  // oxlint-disable-next-line no-await-in-loop -- serial on purpose, see above
  outcomes.push(await grade(task));
}

/**
 * One score per family, as `run.ts` writes one per task: a family with two
 * online graders that both apply is meaned, so the name stays one line.
 * A family none of whose graders applied writes nothing — a pull request
 * about something else is not a pass.
 */
type Score = { readonly name: string; readonly value: number; readonly comment: string };

const byFamily = new Map<string, OnlineVerdict[]>();
for (const { task, verdict } of outcomes) {
  if (verdict.kind === "skipped") continue;
  const name = scoreName(task.grader);
  byFamily.set(name, [...(byFamily.get(name) ?? []), verdict]);
}
const scores: Score[] = [];
const unreachable: string[] = [];
for (const [name, verdicts] of byFamily) {
  for (const verdict of verdicts) {
    if (verdict.kind === "unavailable") unreachable.push(`${name}: ${verdict.reason}`);
  }
  const answered = verdicts.filter((verdict) => verdict.kind === "graded");
  if (answered.length === 0) continue;
  const passed = answered.filter((verdict) => verdict.passed).length;
  scores.push({
    name,
    value: passed / answered.length,
    comment: `${passed}/${answered.length} passed. ${answered.map((verdict) => verdict.reason).join(" | ")}`,
  });
}

const otel = new NodeSDK({ spanProcessors: [new LangfuseSpanProcessor()] });
otel.start();
const langfuse = new LangfuseClient();

const label = pr === undefined ? branch : `#${pr}`;

// Propagated onto the trace rather than set on the span: tags and metadata
// are trace attributes, and the span carries only what it did.
const traceId = await propagateAttributes(
  {
    tags: ["online"],
    traceName: `online ${label}`,
    metadata: {
      pr: pr === undefined ? "none" : String(pr),
      branch,
      headSha,
      baseRef: base,
      baseSha,
      // Which coding agents signed the commits; "none" is a change no agent
      // signed, which is not the same claim as an unrecorded one.
      agents: agents.length === 0 ? "none" : agents.join(","),
      judgeAgent: withJudge ? judgeAgent.id : "none",
      judgeModel: withJudge ? judgeModel : "none",
      judgeEffort: withJudge && judgeEffort !== undefined ? judgeEffort : "none",
      runner: process.env.CI ? "ci" : "local",
    },
  },
  () =>
    startActiveObservation("online", async (span) => {
      span.update({
        input: { title: values.title, body, changedFiles },
        output: Object.fromEntries(
          outcomes.map(({ task, verdict }) => [
            task.id,
            verdict.kind === "graded" ? (verdict.passed ? "pass" : "fail") : verdict.kind,
          ]),
        ),
      });
      for (const score of scores) langfuse.score.trace({ otelSpan: span.otelSpan }, score);
      return span.otelSpan.spanContext().traceId;
    }),
);

await langfuse.flush();
await otel.shutdown();

const traceUrl = await langfuse.api.projects
  .get()
  .then(({ data }) => {
    const host = process.env.LANGFUSE_BASE_URL?.replace(/\/$/, "");
    const project = data[0]?.id;
    return host === undefined || project === undefined
      ? undefined
      : `${host}/project/${project}/traces/${traceId}`;
  })
  .catch(() => undefined);

console.log(`online ${label}: ${changedFiles.length} source file(s) against ${base}`);
for (const { task, verdict } of outcomes) {
  const line =
    verdict.kind === "graded"
      ? `${verdict.passed ? "PASS" : "FAIL"}  ${verdict.reason}`
      : `${verdict.kind}${"reason" in verdict && verdict.reason !== "" ? `  ${verdict.reason}` : ""}`;
  console.log(`  ${scoreName(task.grader).padEnd(20)} ${task.id.padEnd(40)} ${line}`);
}
console.log(
  scores.length === 0
    ? "No gate applied."
    : `Scores: ${scores.map((s) => `${s.name}=${s.value.toFixed(2)}`).join(", ")}`,
);
console.log(traceUrl ?? `Trace ${traceId}`);

if (values["report-file"] !== undefined) {
  const named = ({ verdict }: Outcome): RuleVerdict["verdict"] => {
    if (verdict.kind === "graded") return verdict.passed ? "pass" : "fail";
    if (verdict.kind === "skipped") return "not-judged";
    return verdict.kind;
  };
  await writeReport(values["report-file"], {
    kind: "rules-check",
    base,
    changedFiles: changedFiles.length,
    traceUrl,
    verdicts: outcomes.map((outcome) => ({
      gate: outcome.task.gate,
      task: outcome.task.id,
      verdict: named(outcome),
      reason: "reason" in outcome.verdict ? outcome.verdict.reason : "",
    })),
  });
}

// The line `run.ts` draws: a verdict the harness could not reach is the
// harness failing to measure, and the job should be red for it. The scores it
// did reach stay on the trace — a diff grader's count is an answer whatever
// the judge did.
if (unreachable.length > 0) {
  console.error(`${unreachable.length} verdict(s) could not be reached:`);
  for (const reason of unreachable) console.error(`  ${reason}`);
  process.exit(1);
}
