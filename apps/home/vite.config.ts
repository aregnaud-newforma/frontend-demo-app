import { defineConfig } from "vite";
import { remoteConfig } from "../../vite.base.ts";

/**
 * The HOME remote, and the one build that CONSUMES another.
 *
 * `consumes: ["account"]` is what lets src/HomePage.tsx embed the account's
 * preview as `account/preview`. It is declared here rather than reached for
 * with a package import so that the cost is visible: this build depends on the
 * account's DEPLOYMENT, not on its source. docs/adr/0003 says why that is the
 * point rather than an accident.
 */
export default defineConfig(({ command }) =>
  remoteConfig(
    "home",
    { exposes: { "./pages": "./src/pages.ts" }, consumes: ["account"] },
    command,
  ),
);
