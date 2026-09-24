/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { playwright } from "@vitest/browser-playwright";
import { alias, remotesFromSource } from "./alias.ts";
import { stylexBabelPlugin, stylexPostcss } from "./stylex.config.ts";

// Two projects, two costs - which is the point of the trophy:
//   unit        *.unit.test.ts        pure functions, Node, no DOM, milliseconds
//   integration *.integration.test.tsx the component in a REAL Chromium, where
//                                      most of the coverage belongs
// The FILENAME decides which project a test belongs to, not its folder: the
// level is then visible in the file tree, in the runner output and in a `vitest
// --project unit` run, and a test cannot silently land in the wrong tier by
// being saved in the wrong directory.
// e2e/*.spec.ts is owned by Playwright and belongs to neither project.

// The namespaces as the array form `resolve.alias` takes when a regex entry
// (the remotes) has to sit beside them; the object form cannot hold one.
const toAliasEntries = (map: Record<string, string>) =>
  Object.entries(map).map(([find, replacement]) => ({ find, replacement }));

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
      include: ["src"],
      // What is left is the app's own source. Tests, factories and MSW handlers
      // are the things doing the covering, and counting them flatters the
      // number by measuring the suite against itself; the bootstrap files have
      // no behaviour to lose.
      exclude: [
        "src/**/__tests__/**",
        "src/account/mocks/**",
        "src/testing/**",
        "src/main.tsx",
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
        // Each project resolves on its own, so the namespaces from ./alias.ts
        // have to be declared per project rather than once at the root.
        resolve: { alias },
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
            "src/**/*.unit.test.{ts,tsx}",
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
            plugins: [stylexPostcss(["src/**/*.{ts,tsx}", "packages/tokens/tokens.stylex.ts"])],
          },
        },
        // vitest-browser-react bundles the React it renders with, and a router
        // resolved to a SECOND copy of React sees a null dispatcher - "Cannot
        // read properties of null (reading 'useContext')" the moment a route
        // renders. Deduping pins every dependency to one React instance.
        //
        // The remotes resolve from source here - alias.ts says why the tests
        // are the one place that mapping is allowed.
        resolve: {
          alias: [...toAliasEntries(alias), ...remotesFromSource],
          dedupe: ["react", "react-dom"],
        },
        test: {
          name: "integration",
          globals: true,
          include: ["src/**/*.integration.test.{ts,tsx}"],
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
