/**
 * Runs Lighthouse CI over the pages of the web app - every page, or with
 * `--affected` only those a change reaches.
 *
 *   yarn lighthouse                    every page
 *   yarn lighthouse --affected         the pages the changes since main reach
 *   yarn lighthouse --affected --list  which pages those are, one per line
 *
 * Any other argument goes to `lhci autorun` untouched, which is how CI
 * overrides the upload target.
 *
 * "Reaches" is decided by Turborepo, which already knows the graph:
 * `turbo ls --affected` lists the packages the changes touch, plus every
 * package that depends on one of them, and all of them when a file in
 * turbo.json's globalDependencies changed - vite.base.ts, federation.config.ts,
 * the root package.json. A page is affected when one of the packages it is
 * built from is in that list.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const ORIGIN = "http://localhost:4173";

/**
 * Every page Lighthouse audits, and the packages it is built from. The shell
 * is in each, since it serves them all; packages/ are not in any, because
 * Turborepo already reports the apps that depend on a changed one.
 *
 * `/` lists the account although no package.json says so: the home page
 * embeds the account's preview over the wire (`account/preview`, see
 * apps/home/vite.config.ts), a dependency on a deployment that Turborepo's
 * package graph cannot see.
 */
const PAGES = [
  { path: "/", builtFrom: ["@demo/shell", "@demo/home", "@demo/account"] },
  { path: "/account", builtFrom: ["@demo/shell", "@demo/account"] },
  { path: "/account/edit", builtFrom: ["@demo/shell", "@demo/account"] },
];

const args = process.argv.slice(2);
const affectedOnly = args.includes("--affected");
const listOnly = args.includes("--list");
const lhciArgs = args.filter((arg) => arg !== "--affected" && arg !== "--list");

const affectedPackages = (): Set<string> => {
  const { packages } = JSON.parse(
    execFileSync(
      join(ROOT, "node_modules", ".bin", "turbo"),
      ["ls", "--affected", "--output=json"],
      {
        cwd: ROOT,
      },
    ).toString(),
  ) as { packages: { items: { name: string }[] } };
  return new Set(packages.items.map((item) => item.name));
};

const affected = affectedOnly ? affectedPackages() : undefined;
const pages = PAGES.filter(
  (page) => affected === undefined || page.builtFrom.some((name) => affected.has(name)),
);

if (listOnly) {
  for (const page of pages) console.log(page.path);
  process.exit(0);
}
if (pages.length === 0) {
  console.log("Lighthouse: no page is affected by these changes.");
  process.exit(0);
}

const { status } = spawnSync(
  join(ROOT, "node_modules", ".bin", "lhci"),
  [
    "autorun",
    `--config=${join(import.meta.dirname, "lighthouserc.yml")}`,
    ...pages.map((page) => `--collect.url=${ORIGIN}${page.path}`),
    ...lhciArgs,
  ],
  { cwd: ROOT, stdio: "inherit" },
);
process.exit(status ?? 1);
