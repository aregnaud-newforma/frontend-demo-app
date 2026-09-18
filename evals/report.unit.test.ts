import { renderBenchmark, renderRulesCheck, type BenchmarkReport } from "./report.ts";

const links = { jobUrl: "https://ci/job/1" };

describe("renderRulesCheck", () => {
  it("lists every judged rule, failures first, with the links under the table", () => {
    const comment = renderRulesCheck(
      {
        kind: "rules-check",
        base: "origin/main",
        changedFiles: 3,
        traceUrl: "https://langfuse/trace/abc",
        verdicts: [
          {
            gate: "react",
            task: "fetch-race",
            verdict: "pass",
            reason: "Aborts the stale request.",
          },
          { gate: "typescript", task: "no-enums", verdict: "fail", reason: "Adds `enum Status`." },
          {
            gate: "react",
            task: "move-state",
            verdict: "inapplicable",
            reason: "No shared state.",
          },
          { gate: "testing", task: "msw", verdict: "not-judged", reason: "" },
        ],
      },
      links,
    );

    const rows = comment
      .split("\n")
      .filter((line) => line.startsWith("| ") && !line.startsWith("| Rule"));
    expect(rows.map((row) => row.split(" | ")[1])).toEqual([
      "❌ fail",
      "✅ pass",
      "➖ not about this",
    ]);
    expect(comment).toContain("3 source files against `origin/main`");
    expect(comment).toContain("[Trace in Langfuse](https://langfuse/trace/abc)");
    expect(comment).toContain("[Job](https://ci/job/1)");
    expect(comment).not.toContain("msw");
  });

  it("keeps a pipe or a newline in a reason inside its cell", () => {
    const comment = renderRulesCheck(
      {
        kind: "rules-check",
        base: "origin/main",
        changedFiles: 1,
        traceUrl: undefined,
        verdicts: [{ gate: "react", task: "x", verdict: "fail", reason: "a | b\nc" }],
      },
      links,
    );
    expect(comment).toContain("| a \\| b c |");
    expect(comment).toContain("Trace in Langfuse ·");
  });
});

const run = (over: Partial<BenchmarkReport>): BenchmarkReport => ({
  kind: "benchmark",
  agent: "copilot",
  gate: "react",
  arm: "with-skills",
  model: "gpt-5.4",
  commit: "74a58d5abcdef",
  runUrl: "https://langfuse/run/1",
  passRate: 1,
  tasks: [{ id: "fetch-race", score: 1, comment: "1/1" }],
  unreachable: [],
  ...over,
});

describe("renderBenchmark", () => {
  it("puts one gate per line and one arm per column, each number linking to its run", () => {
    const comment = renderBenchmark(
      [
        run({ arm: "with-skills", passRate: 0.929, runUrl: "https://langfuse/run/with" }),
        run({ arm: "without-skills", passRate: 0.5, runUrl: "https://langfuse/run/without" }),
        run({ gate: "testing", arm: "with-skills", passRate: 0.8 }),
      ],
      links,
    );
    expect(comment).toContain("commit `74a58d5`");
    expect(comment).toContain("| Rule family | Agent | With skills | Without skills |");
    expect(comment).toContain(
      "| react | copilot | [93%](https://langfuse/run/with) | [50%](https://langfuse/run/without) |",
    );
    expect(comment).toContain("| testing | copilot | [80%](https://langfuse/run/1) |  |");
    expect(comment).not.toContain("Previous skill");
  });

  it("says a run could not measure, and why, instead of showing a number", () => {
    const comment = renderBenchmark(
      [
        run({
          passRate: 0.5,
          unreachable: ["judge returned no verdict: x", "judge returned no verdict: x"],
        }),
      ],
      links,
    );
    expect(comment).toContain("| react | copilot | ⚠️ could not measure |");
    expect(comment).toContain("- **react · copilot · with-skills** did not measure:");
    expect(comment.match(/judge returned no verdict/g)).toHaveLength(1);
  });

  it("folds the tasks that did not fully pass under the table", () => {
    const comment = renderBenchmark(
      [
        run({
          passRate: 0.5,
          tasks: [
            { id: "fetch-race", score: 1, comment: "1/1" },
            { id: "move-state", score: 0, comment: "state stayed in the parent" },
          ],
        }),
      ],
      links,
    );
    expect(comment).toContain("<summary>1 task not fully passed</summary>");
    expect(comment).toContain(
      "| react · `move-state` | copilot · with-skills | 0% | state stayed in the parent |",
    );
    expect(comment).not.toContain("`fetch-race`");
  });
});
