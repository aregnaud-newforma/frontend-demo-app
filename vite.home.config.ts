import { defineConfig } from "vite";
import { remoteConfig } from "./vite.base.ts";

/**
 * The home vertical as a remote. See ./vite.account.config.ts. It consumes
 * `account` in turn: the welcome embeds the account's preview
 * (src/home/HomePage.tsx), which makes this build depend on that deployment.
 */
export default defineConfig(({ command }) =>
  remoteConfig(
    "home",
    { exposes: { "./pages": "./src/home/pages.ts" }, consumes: ["account"] },
    command,
  ),
);
