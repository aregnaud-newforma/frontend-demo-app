import { defineConfig } from "vite";
import { remoteConfig } from "./vite.base.ts";

/**
 * The account vertical as a remote: built and served on its own, exposing its
 * pages for the shell to fetch and its preview for the home vertical to embed.
 * What it shares with the other builds, and why a vertical is a remote at all,
 * is in ./vite.base.ts and ./federation.config.ts.
 */
export default defineConfig(({ command }) =>
  remoteConfig(
    "account",
    { exposes: { "./pages": "./src/account/pages.ts", "./preview": "./src/account/preview.ts" } },
    command,
  ),
);
