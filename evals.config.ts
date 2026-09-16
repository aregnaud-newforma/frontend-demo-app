/**
 * What this repository is, to the eval suite in `evals/`: the rules it gates,
 * and what counts as an answer to one. Everything else about a run is a flag —
 * see `evals/config.ts` for why nothing else belongs here.
 */
import type { EvalsConfig } from "./evals/config.ts";
import { TASKS } from "./evals/tasks.ts";

export default {
  tasks: TASKS,
  // src/ whole, extensions included: a test written under it is part of an answer
  // here — one task asks for one — and so would be a stylesheet or a fixture. A
  // change to a config or a doc, at the root, is not an answer to anything.
  //
  // Wider than the file types that exist today on purpose. This is a whitelist,
  // and a whitelist that misses a real answer scores it 0 rather than showing
  // nothing — the one number this suite must not invent.
  //
  // server/ too: the API process is where an API-route rule can be broken, and
  // the javascript gate carries three tasks that ask for a change there.
  sourcePaths: ["src/**", "server/**"],
  defaultAgent: "copilot",
  // The judge is the instrument, so it is named here rather than inherited: this
  // repository grades with Copilot on `gpt-5.4`, which is a different vendor
  // from every agent it measures. The harness default is `claude`, and leaving
  // this out would have meant grading a Claude subject with a Claude reader.
  defaultJudge: "copilot",
} satisfies EvalsConfig;
