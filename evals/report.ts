/**
 * What a run says once it is over, as data: written by `run.ts` and
 * `online.ts` next to the text they print, and rendered by `comment.ts` into
 * the comment CI leaves on a pull request.
 *
 * The comment is for the developer whose pull request it is, not for whoever
 * runs the suite: it carries the verdicts, one sentence each, and the links to
 * where the rest lives. The job summary keeps the harness's own report.
 */
import { writeFile } from "node:fs/promises";

export type TaskResult = {
  readonly id: string;
  /** The task's `*_gate` score, 0 to 1. */
  readonly score: number;
  readonly comment: string;
};

/** One gate in one arm for one agent: one Langfuse dataset run. */
export type BenchmarkReport = {
  readonly kind: "benchmark";
  readonly agent: string;
  readonly gate: string;
  readonly arm: string;
  readonly model: string;
  readonly commit: string;
  readonly runUrl: string | undefined;
  /** The mean of the task scores; missing when no task was scored. */
  readonly passRate: number | undefined;
  readonly tasks: readonly TaskResult[];
  /** Why the run is not a measurement, when it is not. Empty on a kept run. */
  readonly unreachable: readonly string[];
};

export type RuleVerdict = {
  readonly gate: string;
  readonly task: string;
  readonly verdict: "pass" | "fail" | "inapplicable" | "unavailable" | "not-judged";
  readonly reason: string;
};

/** One pull request's diff against every rule that has an online grader. */
export type RulesCheckReport = {
  readonly kind: "rules-check";
  readonly base: string;
  readonly changedFiles: number;
  readonly traceUrl: string | undefined;
  readonly verdicts: readonly RuleVerdict[];
};

export type Report = BenchmarkReport | RulesCheckReport;

export const writeReport = async (path: string, report: Report): Promise<void> => {
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
};

/** A comment is informative whatever it says, and says so before its numbers. */
const NOT_BLOCKING = "Informative only: this never blocks a merge.";

const percent = (rate: number): string => `${Math.round(rate * 100)}%`;

const link = (label: string, url: string | undefined): string =>
  url === undefined ? label : `[${label}](${url})`;

/** A markdown table cell cannot hold a pipe or a line break. */
const cell = (text: string): string => text.replaceAll("|", "\\|").replaceAll(/\s*\n\s*/g, " ");

const VERDICT_LABEL: Record<RuleVerdict["verdict"], string> = {
  pass: "✅ pass",
  fail: "❌ fail",
  inapplicable: "➖ not about this",
  unavailable: "⚠️ could not be judged",
  "not-judged": "judge off",
};

/** Failures first: the verdicts that mean something for this diff are read before the ones that say it is about something else. */
const VERDICT_ORDER: Record<RuleVerdict["verdict"], number> = {
  fail: 0,
  unavailable: 1,
  pass: 2,
  inapplicable: 3,
  "not-judged": 4,
};

/** The rules check, for the pull request it checked: one line per rule. */
export const renderRulesCheck = (
  report: RulesCheckReport,
  links: { readonly jobUrl: string },
): string => {
  const rows = report.verdicts
    .filter((row) => row.verdict !== "not-judged")
    .toSorted((a, b) => VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict])
    .map(
      (row) =>
        `| ${row.gate} · \`${row.task}\` | ${VERDICT_LABEL[row.verdict]} | ${cell(row.reason)} |`,
    );
  const files = `${report.changedFiles} source file${report.changedFiles === 1 ? "" : "s"}`;

  return [
    `## Rules check · ${files} against \`${report.base}\``,
    "",
    `This pull request's diff, checked against the frontend rules by an AI judge. ${NOT_BLOCKING}`,
    "",
    "| Rule | Verdict | Why |",
    "|---|---|---|",
    ...rows,
    "",
    `${link("Trace in Langfuse", report.traceUrl)} · ${link("Job", links.jobUrl)}`,
    "",
  ].join("\n");
};

const ARM_LABEL: Record<string, string> = {
  "with-skills": "With skills",
  "without-skills": "Without skills",
  "previous-skill": "Previous skill",
};

const ARM_ORDER = ["with-skills", "without-skills", "previous-skill"];

/**
 * The benchmark, for the pull request that changed a rule. One line per rule
 * family and agent, one column per arm that ran, so the effect of the skills is
 * read across a line. A run that could not measure says so in its cell rather
 * than showing a number nobody can attribute; what stopped it is under the
 * table, and so are the tasks that did not fully pass.
 */
export const renderBenchmark = (
  reports: readonly BenchmarkReport[],
  links: { readonly jobUrl: string },
): string => {
  const arms = ARM_ORDER.filter((arm) => reports.some((report) => report.arm === arm));
  const lines = new Map<string, BenchmarkReport[]>();
  for (const report of reports) {
    const key = `${report.gate} · ${report.agent}`;
    lines.set(key, [...(lines.get(key) ?? []), report]);
  }

  const rows = [...lines.entries()]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([key, runs]) => {
      const cells = arms.map((arm) => {
        const run = runs.find((report) => report.arm === arm);
        if (run === undefined) return "";
        if (run.unreachable.length > 0) return "⚠️ could not measure";
        if (run.passRate === undefined) return "no task scored";
        return link(percent(run.passRate), run.runUrl);
      });
      return `| ${key} | ${cells.join(" | ")} |`;
    });

  const failures = reports
    .filter((report) => report.unreachable.length > 0)
    .map((report) =>
      [
        `- **${report.gate} · ${report.agent} · ${report.arm}** did not measure:`,
        ...[...new Set(report.unreachable)].map((reason) => `  - ${cell(reason)}`),
      ].join("\n"),
    );

  const missed = reports.flatMap((report) =>
    report.tasks
      .filter((task) => task.score < 1)
      .map(
        (task) =>
          `| ${report.gate} · \`${task.id}\` | ${report.agent} · ${report.arm} | ${percent(task.score)} | ${cell(task.comment)} |`,
      ),
  );

  const commit = reports[0]?.commit.slice(0, 7);
  return [
    `## Skill benchmark${commit === undefined ? "" : ` · commit \`${commit}\``}`,
    "",
    `How often an agent applies each rule family in an exercise, with and without the skills installed. Each number links to its run in Langfuse. ${NOT_BLOCKING}`,
    "",
    `| Rule family · agent | ${arms.map((arm) => ARM_LABEL[arm] ?? arm).join(" | ")} |`,
    `|---|${arms.map(() => "---").join("|")}|`,
    ...rows,
    "",
    ...(failures.length === 0 ? [] : [...failures, ""]),
    ...(missed.length === 0
      ? []
      : [
          "<details>",
          `<summary>${missed.length} task${missed.length === 1 ? "" : "s"} not fully passed</summary>`,
          "",
          "| Task | Run | Score | Why |",
          "|---|---|---|---|",
          ...missed,
          "",
          "</details>",
          "",
        ]),
    link("Job", links.jobUrl),
    "",
  ].join("\n");
};
