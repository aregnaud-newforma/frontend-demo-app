// Runs once per test file before the tests (Vitest `setupFiles`).
// - Imports vitest-browser-react for its side effects/types: it injects
//   `render` onto `page` and teaches TypeScript about it.
// - Starts the MSW Service Worker and resets handlers + mock db per test, so
//   state never leaks between tests.
// Note there is no cleanup() here: vitest-browser-react unmounts the previous
// tree *before* each test rather than after, so the last render stays on screen
// in the Browser UI for inspection.
import "vitest-browser-react";
// The shell's stylesheet, so a component under test is laid out the way it
// ships rather than as unstyled markup. main.tsx is not involved in these
// tests, so nothing else would pull it in.
import "@demo/shell/global.css";
import { afterAll, afterEach, beforeAll } from "vitest";
import { createWorker } from "@demo/testing/worker";
import { accounts } from "@demo/account/mocks/db";
import { handlers } from "@demo/account/mocks/handlers";

// The one place the app's mock network is named. @demo/testing/worker takes the
// handlers rather than importing them, so the harness depends on none of the
// verticals whose tests depend on it; this file is outside every package and
// is therefore where the two can meet.
const worker = createWorker(handlers);

beforeAll(() =>
  worker.start({
    quiet: true,
    // The equivalent of `onUnhandledRequest: "error"` in Browser Mode: only the
    // app's own API calls must be mocked, so an unhandled one fails loudly.
    // Everything else on this origin is Vite serving modules to the test
    // runner, and has to pass through untouched.
    onUnhandledRequest(request, print) {
      if (new URL(request.url).pathname.startsWith("/api/")) print.error();
    },
  }),
);

afterEach(() => {
  worker.resetHandlers(); // drop per-test handler overrides
  accounts.clear(); // each test seeds its own account
});

afterAll(() => worker.stop());
