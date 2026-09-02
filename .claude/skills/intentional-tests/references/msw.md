# msw

The seam every integration journey crosses. [`shape.md`](shape.md) says the network is the
only substitution a journey makes; this file says how that substitution is written. The
dialect settles the entry and the polyfills around it.

## The server and its lifecycle

```ts
// the test-support directory
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

```ts
// the setup file the runner names
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`onUnhandledRequest: "error"` is what the whole seam rests on: a request no handler answers
fails the test that made it. Left at its default, a journey reaching an endpoint nobody
mocked passes green while proving nothing — the exact failure this skill exists to hunt.

`resetHandlers()` drops what one test added, so the next journey starts on the shared set
alone. Its absence reads as a flaky suite: a test passing alone and failing in file order.

## The shared set

It holds the endpoints a journey crosses without caring about — the ones whose answer changes
nothing the journey asserts. **Split on the file system: one module per domain, each
exporting its own `handlers`, composed into one network description at the index.**

```
handlers/
  projects.ts
  checkout.ts
  index.ts
```

```ts
// handlers/projects.ts — the endpoints that concern projects
export const handlers = [
  http.get("*/hubs/:hubId/projects/:projectId/users", () => HttpResponse.json([])),
];
```

```ts
// handlers/index.ts — the domain sets as a single network description
import { handlers as projectsHandlers } from "./projects";
import { handlers as checkoutHandlers } from "./checkout";

export const handlers = [...projectsHandlers, ...checkoutHandlers];
```

The server starts on that index set, and adding an endpoint touches the one domain that owns
it.

- **A leading `*`** where the app resolves its base URL at runtime: the pattern matches
  whatever host it resolved to.
- **`:param` segments** match any value, and a journey proving the request went to the right
  one reads it off the handler's `params`.

## A journey's own handlers

`server.use(…)` in the test body takes precedence over the shared set until the reset. Every
answer a journey turns on is written there — its fixture, its failure, its in-flight state —
leaving the shared set as what every journey can live with.

- **Read-only** — one handler per endpoint the journey calls, answering a built fixture.
- **A refusal** — `HttpResponse.json({ message: "nope" }, { status: 500 })`, for the edge
  case that asserts what the user sees when the server says no.
- **Round-trip** — a journey that writes then reads back what it wrote earns a real store
  under its handlers: `@msw/data`'s `Collection` under a `Zod` schema
  (`new Collection({ schema: z.object({ … }) })`), one per resource, reset alongside the
  handlers, so the test can end on what the backend holds — the edit persisted, or nothing
  sent.
- **In flight** — the answer is **held**, below.

## A held answer

A journey asserting an in-flight state — the spinner, the disabled save button, the skeleton
row — needs the request still open when that assertion runs. **The test holds the answer and
releases it on the line where the request should land**: the handler awaits a promise, the
journey resolves it. `deferred` hands both halves back together, and lives beside the server:

```ts
export const deferred = <T = void>() => {
  let resolve: (value: T) => void = () => {};

  const promise = new Promise<T>((resolveIt) => {
    resolve = resolveIt;
  });

  return { promise, resolve };
};
```

Where the runtime ships `Promise.withResolvers` and the `lib` setting types it, that is the
same thing built in, and the helper goes.

A world function opens the request and hands back the release:

```ts
const aCreationTheServerHasNotAnsweredYet = () => {
  const { promise: serverAnswers, resolve: answer } = deferred();

  server.use(
    http.post(FIELD_REPORTS_PATH, async () => {
      await serverAnswers;
      return HttpResponse.json({ item: { id: A_FIELD_REPORT_ID } }, { status: 201 });
    }),
  );

  return { serverCreates: answer };
};
```

```tsx
// When the user saves and the server has yet to answer
const { serverCreates } = aCreationTheServerHasNotAnsweredYet();
await screen.saveForm();
expect(screen.savingButton()).toBeDisabled();

// Then the report opens once it lands
serverCreates();
expect(await screen.findReportTitle(A_TITLE)).toBeVisible();
```

The same holds for a screen's arrival state: hold the fetch, assert the loading state,
release, assert what loaded.

`delay()` and the fake clock time the answer instead of placing it, so the assertion races a
duration nobody controls — green on a fast machine, red in CI. A held answer lands where the
test puts it, and the journey reads as the sequence the user lived.
