/**
 * Brings the runs CI made into the LHCI server on this machine, so its
 * dashboard shows every PR and every commit on main, not only the runs made
 * here. `yarn lhci:start` calls it after the server is up.
 *
 *   yarn lighthouse:pull
 *
 * CI cannot upload here itself - nothing hosts this server - so each run of
 * .github/workflows/lighthouse.yml keeps its raw results as an artifact, next
 * to the build context the server files them under: the commit, its branch,
 * and the commit on main it is compared against. This downloads those
 * artifacts and runs `lhci upload` over each, oldest first.
 *
 * A run is skipped when the server already has a build pointing at it, so a
 * second pull only fetches what is new. The server is the record of what was
 * imported, not a file here: a reset volume is re-filled by the next pull.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SERVER = "http://localhost:9001";
const CONFIG = join(import.meta.dirname, "lighthouserc.yml");
const LHCI = join(import.meta.dirname, "..", "node_modules", ".bin", "lhci");

/**
 * How far back to look. GitHub deletes an artifact after 90 days, so an
 * older run has nothing to download anyway.
 */
const RUNS = 50;

interface Run {
  databaseId: number;
  url: string;
  headBranch: string;
}

interface Build {
  externalBuildUrl: string;
}

const token = process.env.LHCI_TOKEN;
if (token === undefined) {
  console.error("LHCI_TOKEN is not set. .env.example says where it comes from.");
  process.exit(1);
}

const lookup = await fetch(`${SERVER}/v1/projects/lookup`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ token }),
});
if (!lookup.ok) {
  console.error(`No project on ${SERVER} has this LHCI_TOKEN (HTTP ${lookup.status}).`);
  process.exit(1);
}
const { id } = (await lookup.json()) as { id: string };
const builds = (await (await fetch(`${SERVER}/v1/projects/${id}/builds`)).json()) as Build[];
const imported = new Set(builds.map((build) => build.externalBuildUrl));

const runs = (
  JSON.parse(
    execFileSync("gh", [
      "run",
      "list",
      "--workflow=lighthouse.yml",
      "--status=completed",
      `--limit=${RUNS}`,
      "--json=databaseId,url,headBranch",
    ]).toString(),
  ) as Run[]
)
  .filter((run) => !imported.has(run.url))
  .toReversed();

let pulled = 0;
for (const run of runs) {
  const dir = mkdtempSync(join(tmpdir(), "lighthouse-pull-"));
  try {
    // A run that failed before collect, or that predates the artifact, has
    // nothing to download - skipped, not an error.
    try {
      execFileSync(
        "gh",
        [
          "run",
          "download",
          String(run.databaseId),
          "--name=lighthouse",
          `--dir=${join(dir, ".lighthouseci")}`,
        ],
        { stdio: "ignore" },
      );
    } catch {
      continue;
    }
    const context = JSON.parse(
      readFileSync(join(dir, ".lighthouseci", "build-context.json"), "utf8"),
    ) as Record<string, string>;

    // `lhci upload` reads the results from .lighthouseci/ under its cwd, and
    // the build context from these variables before it would ask git - which
    // matters, since the commit may exist on no branch this clone has.
    execFileSync(LHCI, ["upload", `--config=${CONFIG}`, "--ignoreDuplicateBuildFailure"], {
      cwd: dir,
      env: { ...process.env, ...context },
      // Its errors, not its progress: one line per run is enough to read.
      stdio: ["ignore", "ignore", "inherit"],
    });
    console.log(`Lighthouse: pulled ${run.headBranch} (${run.url})`);
    pulled += 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
if (pulled === 0) console.log("Lighthouse: nothing new from CI.");
