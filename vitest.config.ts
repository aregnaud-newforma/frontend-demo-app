/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { playwright } from "@vitest/browser-playwright";
import { fromRoot, stylexBabelPlugin, stylexPostcss } from "./stylex.config.ts";

// Two projects, two costs - which is the point of the trophy:
//   unit        *.unit.test.ts        pure functions, Node, no DOM, milliseconds
//   integration *.integration.test.tsx the component in a REAL Chromium, where
//                                      most of the coverage belongs
// The FILENAME decides which project a test belongs to, not its folder: the
// level is then visible in the file tree, in the runner output and in a `vitest
// --project unit` run, and a test cannot silently land in the wrong tier by
// being saved in the wrong directory.
// e2e/*.spec.ts is owned by Playwright and belongs to neither project.

/**
 * The remotes, resolved from source rather than over the wire - for the tests
 * only. `account/pages` in apps/shell/src/routes.tsx is a federated module
 * (see ./federation.config.ts): in the shell build the plugin fetches it from
 * the account remote, and no such plugin runs in Vitest. This maps the same
 * specifier onto the same file the remote would have built from, so the test
 * tier mounts the route tree the shell ships, minus the network. The e2e tier
 * is the one that crosses it.
 *
 * Deliberately here and nowhere else. In a BUILD, this mapping would make the
 * shell bundle the pages it is supposed to fetch and the federation would be
 * silently bypassed. It is also why the packages are SCOPED - `@demo/account`,
 * not `account`: a package literally named `account` would make
 * `import("account/pages")` resolve as a real package subpath in the shell's
 * build, with the same result and nothing to remove.
 */
const remotesFromSource = [{ find: /^(account|home)\//, replacement: fromRoot("apps/$1/src/") }];

export default defineConfig({
  test: {
    // Coverage is a ROOT option, never a per-project one: both projects
    // instrument the same `src/`, and one set of numbers over the two is the
    // only reading that means anything - a helper covered by a unit test and a
    // page covered in Chromium are the same source either way.
    coverage: {
      // v8 is the default; naming it keeps the choice visible next to the
      // browser project, which is the half people expect to be missing.
      provider: "v8",
      // Root-relative, and a non-wildcard pattern is read as a directory.
      include: ["apps/*/src", "packages/*/src", "packages/tokens"],
      // What is left is the app's own source. Tests, factories and MSW handlers
      // are the things doing the covering, and counting them flatters the
      // number by measuring the suite against itself; the bootstrap files have
      // no behaviour to lose.
      exclude: [
        "**/__tests__/**",
        "packages/account-core/src/mocks/**",
        // The mobile app is React Native: jest-expo runs it (apps/mobile/jest.config.js),
        // so nothing here ever loads those files and `coverage.all` would
        // otherwise report every one of them at 0%.
        "apps/mobile/**",
        "apps/shell/src/main.tsx",
        "src/routes.tsx",
      ],
      // `text` prints the table but HIDES every file already at 100%, so a file
      // that slips from 100% to 90% appears out of nowhere and one that was
      // never instrumented looks identical to one that was perfect. The summary
      // json carries every file either way, which is what makes a before/after
      // comparison (see .claude/skills/tune-tests) an actual subtraction.
      reporter: ["text", "json-summary", "html"],
    },
    projects: [
      {
        // No `resolve` of its own: what the namespaces used to need is a
        // package name now, and the unit tier never touches a federated
        // specifier - those only appear in the route tree, which only the
        // integration tier mounts.
        test: {
          name: "unit",
          // Injects describe/it/expect as globals so test files need no imports.
          globals: true,
          environment: "node",
          // `evals/` is the harness, not the app: its pure helpers (how a
          // judge's reply is read) are unit tests like any other, and it has
          // no browser half. `server/` is here for the half of the backend that
          // is Node (docs/adr/0005) - the notifications service's message
          // rendering is a pure function like any other. The account API is
          // still .NET and its own tests still run under xunit
          // (`yarn server:test`), which is why this is a pattern and not the
          // whole folder.
          include: [
            "apps/*/src/**/*.unit.test.{ts,tsx}",
            "packages/*/src/**/*.unit.test.{ts,tsx}",
            "evals/**/*.unit.test.ts",
            "server/**/*.unit.test.ts",
          ],
        },
      },
      {
        // Browser Mode serves the test files through its OWN Vite pipeline, so
        // everything the app's build does has to be declared here too: the
        // React plugin, the compiler pass, and both halves of StyleX. Without
        // the last of those the components render carrying compiled class
        // names that no stylesheet defines, and the tests would be driving
        // something the users never see.
        plugins: [
          react(),
          babel({ presets: [reactCompilerPreset()], plugins: [stylexBabelPlugin] }),
        ],
        // All of src/, where each build (vite.base.ts) names only its slice:
        // Browser Mode may mount any component, so it needs every rule.
        css: {
          postcss: {
            plugins: [
              stylexPostcss([
                fromRoot("apps/*/src/**/*.{ts,tsx}"),
                fromRoot("packages/tokens/tokens.stylex.ts"),
              ]),
            ],
          },
        },
        // vitest-browser-react bundles the React it renders with, and a router
        // resolved to a SECOND copy of React sees a null dispatcher - "Cannot
        // read properties of null (reading 'useContext')" the moment a route
        // renders. Deduping pins every dependency to one React instance.
        //
        // The remotes resolve from source here - `remotesFromSource` above says
        // why the tests are the one place that mapping is allowed.
        resolve: {
          alias: remotesFromSource,
          dedupe: ["react", "react-dom"],
        },
        test: {
          name: "integration",
          globals: true,
          include: ["apps/*/src/**/*.integration.test.{ts,tsx}"],
          setupFiles: ["./vitest.setup.ts"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
            // Off by choice: the default writes a .png per failing test into
            // __screenshots__/ (plus .vitest-attachments/). The failure message
            // and the locator that produced it are what actually diagnose these
            // tests, and stray binaries in the tree are not worth the noise.
            screenshotFailures: false,
          },
        },
      },
    ],
  },
});
