/**
 * Runs a command with the Datadog credentials datadog-ci expects, spelled the
 * way it reads them.
 *
 *   node --env-file-if-exists=.env synthetics/datadog-env.ts datadog-ci synthetics run-tests
 *
 * The repository's .env names the key once, as DATADOG_API_KEY, and the site
 * once, as VITE_DATADOG_SITE (.env.example). datadog-ci reads DD_API_KEY,
 * DD_APP_KEY and DATADOG_SITE. Translated here rather than asking for the same
 * values twice in .env, where they could drift apart.
 *
 * It needs an APPLICATION key besides the API key: triggering a test is an
 * action on your behalf, not telemetry. It is DATADOG_APP_KEY in .env.
 */
import { spawnSync } from "node:child_process";

const [command, ...args] = process.argv.slice(2);
const apiKey = process.env.DATADOG_API_KEY;
const appKey = process.env.DATADOG_APP_KEY;
const site = process.env.VITE_DATADOG_SITE || "datadoghq.com";

if (!command) {
  console.error("Usage: datadog-env.ts <command> [args...]");
  process.exit(2);
}
if (!apiKey || !appKey) {
  console.error("DATADOG_API_KEY and DATADOG_APP_KEY must both be set in .env (see .env.example).");
  process.exit(2);
}

const { status, error } = spawnSync(command, args, {
  stdio: "inherit",
  env: { ...process.env, DD_API_KEY: apiKey, DD_APP_KEY: appKey, DATADOG_SITE: site },
});

if (error) {
  console.error(`Could not run ${command}: ${error.message}`);
  process.exit(1);
}
process.exit(status ?? 1);
