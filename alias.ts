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
  "@activity": folder("activity"),
  "@home": folder("home"),
  "@layout": folder("layout"),
  "@testing": folder("testing"),
};
