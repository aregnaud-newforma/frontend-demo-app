import { defineConfig } from "vite";
import { remoteConfig } from "../../vite.base.ts";

/**
 * The ACCOUNT remote. Everything that is the same for every remote is in
 * ../../vite.base.ts; what is here is what only this one knows - the two
 * modules it exposes.
 *
 * `./pages` and `./preview` are separate entries on purpose: a consumer that
 * wants the preview should not pull the pages' chunk with it. src/preview.ts
 * says the rest.
 */
export default defineConfig(({ command }) =>
  remoteConfig(
    "account",
    { exposes: { "./pages": "./src/pages.ts", "./preview": "./src/preview.ts" } },
    command,
  ),
);
