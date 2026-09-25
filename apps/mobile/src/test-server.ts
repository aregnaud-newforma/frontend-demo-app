import { setupServer } from "msw/node";
import { handlers } from "@demo/account-core/mocks/handlers";

/**
 * One MSW server for the whole jest run - the twin of
 * packages/testing/src/worker.ts, which does the same job for Browser Mode with
 * a Service Worker instead.
 *
 * `msw/node`, not `msw/native`: the app uses the native integration at runtime,
 * but a Jest test runs on Node, where the http interceptor is the one that
 * works.
 *
 * Deliberately ONE instance rather than one per file: `server.use(...)` in a
 * test adds an override that `resetHandlers()` drops after it, and both only
 * mean anything against the server ../jest.setup.ts started. Passing the
 * handlers to `setupServer` rather than `use`-ing them afterwards is what makes
 * them the list `resetHandlers()` returns to.
 *
 * The handlers come from @demo/account-core - the same ones the web's tiers
 * mock with, which is the point: two runners, one description of the API.
 */
export const server = setupServer(...handlers);
