/**
 * Which revision of which repository holds the rules under test.
 *
 * A file of its own, and JSON rather than a key in `evals.config.ts`, for two
 * reasons that both come from what it is: not a condition of a run but the
 * subject of one.
 *
 * Bumping it is how a rule change reaches this repository now, and the workflow
 * treats a change to `evals.config.ts` as a change to what a trial *is* — every
 * gate in both arms. A rule edit does not move the ablated arm, which the
 * workflow's own comment says: `without-skills` strips the rule before the agent
 * starts, so re-measuring it is paying to watch a constant. Keeping the pin out
 * of the config is what lets CI tell the two events apart.
 *
 * And JSON so the workflow can read it with `jq` before Node exists, which is
 * where the gate matrix is decided.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { repoRoot } from "./config.ts";

export type SkillsPin = {
  /** A git remote. Cloned by the harness, or by CI with its deploy key. */
  readonly url: string;
  /**
   * A branch or a commit. A branch is allowed and is not a pin: the commit it
   * resolved to is recorded with every score, so a run says what it measured
   * even when the name it was given has moved since.
   */
  readonly ref: string;
  /** The directory inside that repository holding one folder per skill. */
  readonly path: string;
};

const PIN_FILE = join(repoRoot, "evals", "skills.pin.json");

const fail = (reason: string): never => {
  console.error(`evals/skills.pin.json: ${reason}`);
  process.exit(1);
};

const loaded = await readFile(PIN_FILE, "utf8").catch(() =>
  fail("could not be read. It names the repository the rules under test live in."),
);

const parsed = ((): Partial<SkillsPin> => {
  try {
    return JSON.parse(loaded) as Partial<SkillsPin>;
  } catch (error) {
    return fail(`is not valid JSON: ${String(error)}`);
  }
})();

const required = (key: keyof SkillsPin): string => {
  const value = parsed[key];
  // Checked rather than trusted to the type: this file is data on disk, not part
  // of the program `tsc` compiles, and a missing key would otherwise surface as
  // a git command built around the word "undefined".
  if (typeof value !== "string" || value.trim() === "") {
    return fail(`\`${key}\` is missing. It takes a url, a ref and a path.`);
  }
  return value;
};

export const pin: SkillsPin = {
  url: required("url"),
  ref: required("ref"),
  path: required("path"),
};
