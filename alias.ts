import { fileURLToPath } from "node:url";

/**
 * One namespace per top-level folder in src/, so an import says which part of
 * the codebase it reaches into instead of counting how far up it has to climb.
 *
 * The rule is: RELATIVE inside a folder, NAMESPACED across one. `./helpers/api`
 * stays relative because moving the account vertical moves it too; a test
 * reaching for `@testing/render-route` names its target because the harness is
 * somewhere else entirely. That also makes the dependency direction the README
 * describes visible at a glance - `@account/...` appearing inside src/home/ is a
 * vertical importing a vertical, and it now looks like one.
 *
 * Kept here rather than repeated in vite.config.ts and vitest.config.ts, which
 * both import it. tsconfig.json still has to spell the same list out in `paths`
 * (JSON cannot import this file) - that duplication is the one thing to keep in
 * sync, and adding vite-tsconfig-paths would remove it at the cost of a
 * dependency.
 */
const folder = (name: string) => fileURLToPath(new URL(`./src/${name}`, import.meta.url));

export const alias = {
  "@account": folder("account"),
  "@home": folder("home"),
  "@layout": folder("layout"),
  "@testing": folder("testing"),
};

/**
 * The remotes, resolved from source rather than over the wire - for the tests
 * only. `account/pages` in src/routes.tsx is a federated module (see
 * ../federation.config.ts): in the shell build the plugin fetches it from the
 * account remote, and no such plugin runs in Vitest. This maps the same
 * specifier onto the same file the remote would have built from, so the test
 * tier mounts the route tree the shell ships, minus the network. The e2e tier
 * is the one that crosses it.
 *
 * Deliberately NOT in `alias` above: with it, the shell's Vite build would
 * bundle the pages it is supposed to fetch, and the federation would be
 * silently bypassed.
 */
export const remotesFromSource = [{ find: /^(account|home)\//, replacement: `${folder("")}$1/` }];
