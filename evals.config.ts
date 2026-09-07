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
  sourcePaths: ["src/**"],
} satisfies EvalsConfig;
