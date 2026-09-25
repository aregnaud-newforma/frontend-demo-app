/**
 * Runs once per test file, before the tests - the mobile twin of the
 * repository's vitest.setup.ts, and deliberately the same lifecycle: one mock
 * network, handlers reset and the store cleared between tests, so state never
 * leaks from one to the next.
 *
 * Unistyles is set up in ./jest.setup-unistyles.js instead, which runs earlier;
 * that file says why it cannot be done here.
 */
import { accounts } from "@demo/account-core/mocks/db";
import { setApiBaseUrl } from "@demo/account-core/api-base-url";
import { server } from "./src/test-server";

// What src/api-config.ts does from the environment at startup. A literal here
// rather than the variable, because the tests never reach a real API and an
// unset EXPO_PUBLIC_API_URL must not be able to make them fail.
setApiBaseUrl("http://localhost");

beforeAll(() =>
  server.listen({
    // The equivalent of the browser setup's rule: the app's own API calls must
    // be mocked, so an unhandled one fails loudly.
    onUnhandledRequest: "error",
  }),
);

afterEach(() => {
  server.resetHandlers(); // drop per-test handler overrides
  accounts.clear(); // each test seeds its own account
});

afterAll(() => server.close());
