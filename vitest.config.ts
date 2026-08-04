/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { playwright } from "@vitest/browser-playwright";
import { alias } from "./alias.ts";

// Two projects, two costs - which is the point of the pyramid:
//   unit        *.unit.test.ts        pure functions, Node, no DOM, milliseconds
//   integration *.integration.test.tsx the component in a REAL Chromium
// The FILENAME decides which project a test belongs to, not its folder: the
// level is then visible in the file tree, in the runner output and in a `vitest
// --project unit` run, and a test cannot silently land in the wrong tier by
// being saved in the wrong directory.
// e2e/*.spec.ts is owned by Playwright and belongs to neither project.
export default defineConfig({
  test: {
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
          include: ["src/**/*.unit.test.{ts,tsx}"],
        },
      },
      {
        // Browser Mode serves the test files through Vite, so the React plugin
        // has to be declared on the project, not only on the app config - and
        // the compiler pass with it, so the integration tests run against the
        // same compiled components the app ships.
        plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
        // vitest-browser-react bundles the React it renders with, and a router
        // resolved to a SECOND copy of React sees a null dispatcher - "Cannot
        // read properties of null (reading 'useContext')" the moment a route
        // renders. Deduping pins every dependency to one React instance.
        resolve: { alias, dedupe: ["react", "react-dom"] },
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
