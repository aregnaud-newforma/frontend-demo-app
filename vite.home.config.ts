import { defineConfig } from "vite";
import { remoteConfig } from "./vite.base.ts";

/** The home vertical as a remote. See ./vite.account.config.ts. */
export default defineConfig(remoteConfig("home", { "./pages": "./src/home/pages.ts" }));
