import { defineConfig } from "vite";
import { remoteConfig } from "./vite.base.ts";

/**
 * The account vertical as a remote: built and served on its own, exposing its
 * pages for the shell to fetch. What it shares with the other builds, and why
 * a vertical is a remote at all, is in ./vite.base.ts and ./federation.config.ts.
 */
export default defineConfig(remoteConfig("account", { "./pages": "./src/account/pages.ts" }));
