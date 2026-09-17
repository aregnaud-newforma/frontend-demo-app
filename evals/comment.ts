/**
 * Renders the reports a run wrote into the comment CI leaves on the pull
 * request. See `report.ts` for what a report holds and how it reads.
 *
 *   yarn evals:comment --rules-check report.json --job-url URL
 *   yarn evals:comment --benchmark reports/ --job-url URL
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { renderBenchmark, renderRulesCheck, type BenchmarkReport, type Report } from "./report.ts";

const { values } = parseArgs({
  options: {
    "rules-check": { type: "string" },
    benchmark: { type: "string" },
    "job-url": { type: "string" },
  },
});

if (values["job-url"] === undefined) {
  console.error("--job-url is required: where the reader goes for the whole log.");
  process.exit(1);
}
const links = { jobUrl: values["job-url"] };

const readReport = async (path: string): Promise<Report> =>
  JSON.parse(await readFile(path, "utf8")) as Report;

if (values["rules-check"] !== undefined) {
  const report = await readReport(values["rules-check"]);
  if (report.kind !== "rules-check") {
    console.error(`${values["rules-check"]} is a ${report.kind} report, not a rules check.`);
    process.exit(1);
  }
  process.stdout.write(renderRulesCheck(report, links));
} else if (values.benchmark !== undefined) {
  const dir = values.benchmark;
  const names = (await readdir(dir)).filter((name) => name.endsWith(".json")).toSorted();
  const reports = await Promise.all(names.map((name) => readReport(join(dir, name))));
  const benchmarks = reports.filter(
    (report): report is BenchmarkReport => report.kind === "benchmark",
  );
  if (benchmarks.length === 0) {
    console.error(`No benchmark report in ${dir}.`);
    process.exit(1);
  }
  process.stdout.write(renderBenchmark(benchmarks, links));
} else {
  console.error("One of --rules-check FILE or --benchmark DIR is required.");
  process.exit(1);
}
