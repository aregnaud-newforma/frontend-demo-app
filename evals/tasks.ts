/**
 * The eval suite of this repository: one task per rule an agent working here is
 * meant to apply and no linter can check. Read through `evals.config.ts`, which
 * is what the harness loads; the shape of a task and the grading of its answer
 * are in `./grading.ts` and are not this repository's business.
 *
 * Prompts are deliberately indirect. Naming the rule ("do not use an effect")
 * would measure instruction-following instead of whether the agent retrieved
 * the skill, so each prompt states only the product need.
 */
import type { EvalTask } from "./grading.ts";

export const TASKS: readonly EvalTask[] = [
  {
    id: "rerender-derived-state-no-effect",
    gate: "react",
    grader: {
      kind: "diff",
      family: "effects",
      expect: "none",
      added: String.raw`\buse(Layout)?Effect\s*\(`,
    },
    prompts: [
      "On EditAccountPage, show how many characters remain under the bio field as the user types, out of the field's maximum.",
    ],
    rationale:
      "A value computable from current props or state is derived during render, never stored in state and never updated by an effect.",
    checks: "skip",
  },
  {
    id: "effects-reset-state-with-key",
    gate: "react",
    grader: {
      kind: "judge",
      family: "effects",
      criterion: [
        "What is graded is how the form's state is made fresh when the account prop changes to a different account, nothing else.",
        "PASS if the component that calls useForm is rendered with a key derived from the account id or the account itself, so a different account remounts it with fresh state.",
        "FAIL if a useEffect or useLayoutEffect resets the form or its fields when the account changes.",
        "FAIL if the existing form instance is expected to pick up new defaultValues on its own, with no key and no reset: it keeps the state it already has.",
        "FAIL if nothing addresses the reset at all.",
      ].join(" "),
    },
    prompts: [
      "On EditAccountPage, AccountFields receives the account as a prop. Make it hold up when that prop switches to a different account (a different id) while the component stays mounted: the form must show the new account's values and never the previous account's, not even briefly. The routing work that will make the account change is someone else's change and out of scope here.",
    ],
    rationale:
      "State that must reset when a prop changes is reset by a `key` from the parent, which remounts in a single pass, not by an effect that clears it after a stale render. The route has no id today, so the prompt states the contract the component must hold when the prop changes, and puts the routing out of scope: a version that asked the agent to build the route first ran out of turns at 40 with six files touched, and an earlier version that described an id change the code cannot produce was answered for a bug neither arm could reproduce. Judge-graded because the absence of an effect is not the presence of a key: an agent that adds the route and forgets the form entirely adds no effect either.",
    checks: "skip",
  },
  {
    id: "effects-dom-sync-is-valid",
    gate: "react",
    grader: {
      kind: "judge",
      family: "effects",
      criterion: [
        "What is graded is when the scroll runs relative to the banner being in the DOM.",
        "PASS if scrollIntoView, focus or an equivalent runs after commit: inside a useEffect or useLayoutEffect that fires when the banner is shown, or in a ref callback on the banner element, or after a flushSync in the handler that shows it.",
        "FAIL if the scroll is called in a component's render body.",
        "FAIL if the scroll is called from the mutation's onError or a submit handler with nothing that guarantees the banner is mounted yet: no flushSync, no ref callback, no effect.",
        "FAIL if nothing scrolls the banner into view.",
        "Judge only the mechanism, not the markup or the styling.",
      ].join(" "),
    },
    prompts: [
      "On EditAccountPage, when a save fails the error banner appears under the Save button, which on a small screen is below the fold. Bring the banner into view when it appears.",
    ],
    rationale:
      "Synchronising with an external system — the DOM included — is what an effect is for, so no branch of the tree applies and the effect stands. The banner is the save error on EditAccountPage: the load error on AccountPage is the only thing that page renders when it fails, so it cannot be below a fold. Judge-graded because a ref callback is as correct as the effect and has no signature a diff can count; what separates right from wrong here is whether the scroll runs after commit or before the node exists.",
    checks: "skip",
  },
  {
    id: "rerender-move-state-down",
    gate: "react",
    grader: {
      kind: "judge",
      family: "rerender",
      criterion: [
        "The state that drives the panel must live in a component that renders only the panel and the button that toggles it.",
        "PASS if a new component owns the open/closed state, so toggling it cannot re-render the account summary list.",
        "PASS also if no React state is declared because a native details element holds the open/closed state: the summary list is untouched by the toggle, which is what the rule protects.",
        "FAIL if the state is declared in AccountPage itself, where the summary list is a sibling of it in the returned JSX. This holds even if the summary is argued to be cheap or the React Compiler is argued to memoize it: the rule asks for the state to move first.",
        "FAIL if the re-render is addressed with useMemo, useCallback or memo instead of by where the state lives.",
        "Judge only where the state is declared, not whether the panel looks right.",
      ].join(" "),
    },
    prompts: [
      "On AccountPage, add a button that reveals the account's raw JSON in a panel below the summary, and hides it again.",
    ],
    rationale:
      "State declared in a component re-renders everything that component returns. When only a small part of the tree uses it, the fix is to extract that part and move the state into it — not to memoize the siblings. This one is judge-graded because both answers add a `useState` and the diffs differ only in which function encloses it. A native `<details>` passes: it declares no state anywhere, which satisfies the rule's intent by other means, and a criterion that failed correct code would measure the criterion.",
    checks: "skip",
  },
  {
    id: "modern-array-tosorted",
    gate: "javascript",
    grader: {
      kind: "diff",
      family: "modern",
      expect: "some",
      added: String.raw`\.(toSorted|toReversed|toSpliced)\s*\(`,
    },
    prompts: [
      "The language dropdown on EditAccountPage lists its options in the order the languages are declared. List them in alphabetical order of the label the visitor reads instead.",
    ],
    rationale:
      "Sorting produces a new array with `toSorted`, never a mutated one. `LANGUAGES` is a `readonly` tuple, so the temptation is a defensive copy — `[...LANGUAGES].sort()` — which the rule names as the fallback for browsers this repo does not support.",
    checks: "skip",
  },
  {
    id: "modern-set-operations",
    gate: "javascript",
    grader: {
      kind: "judge",
      family: "modern",
      criterion: [
        "What is graded is whether the agent checked the rule's precondition before applying it, not which API it used.",
        "PASS only if the agent avoided the native Set methods (difference, union, intersection, symmetricDifference, isSubsetOf, isSupersetOf, isDisjointFrom) AND said why — that they need a newer language level than this repository targets, or named ES2025, or named the tsconfig lib floor.",
        "FAIL if the agent used a native Set method.",
        "FAIL if the agent avoided them but gave no sign of having checked whether they were available; writing an array filter out of habit is not the same answer as declining the API on purpose, and only the stated reason separates the two.",
      ].join(" "),
    },
    prompts: [
      "On EditAccountPage, list under the form which of the required fields still have no value, so the visitor can see what is left before submitting.",
    ],
    rationale:
      "The `Set` methods are the natural shape for this — the difference between the fields the schema requires and the fields that carry a value — and the rule that names them declares `requires: ES2025`. This repo sits at `lib` ES2023, so the precondition fails and the rule does not apply: the correct answer is the array filter it would otherwise replace. Judge-graded, and it is the task that forced the judge to exist: an agent with no skills writes the same filter out of ignorance, so the diff is identical in both arms and only the agent's stated reasoning tells them apart. The checks run because `tsc` catches the wrong answer here, with TS2550.",
    checks: "run",
  },
  {
    id: "derive-vs-decouple",
    gate: "typescript",
    grader: {
      kind: "judge",
      family: "derive",
      criterion: [
        "The new component's props must be declared standalone, not derived from the Account data type.",
        "PASS if the props are their own type or inline object literal naming the strings the component renders.",
        "FAIL if the props are derived from Account with Pick, Omit, or any mapped or indexed access type.",
        "FAIL if the component takes the whole account object as a prop.",
        "Judge only how the props are typed, not the markup or the styling.",
      ].join(" "),
    },
    prompts: [
      "Add a component that shows a person's initials in a circle beside their full name, and put it at the top of AccountPage.",
    ],
    rationale:
      'An avatar is a UI concern and `Account` is a data type; they evolve independently, so coupling them creates work later. The temptation is `Pick<Account, "nom" | "prenom">`, which is free to write and binds a presentational component to the server\'s field names. Judge-graded because `Pick`, `Omit`, a whole-object prop and a standalone type all render identically and only the type declaration separates them. The checks are skipped: nothing in `tsc` or the test suite tells a `Pick` from a standalone type, so they would be cost without signal.',
    checks: "skip",
  },
  {
    id: "seam-msw-over-module-mock",
    gate: "testing",
    grader: {
      kind: "judge",
      family: "seam",
      criterion: [
        "What is graded is how the new behaviour is proven, not how it is implemented.",
        "PASS if an integration test (a *.integration.test.tsx file) drives the real page through the form, answers the PUT on the account URL with a 409 through an msw handler (http.put inside server.use or worker.use, or a new handler in mocks/handlers.ts), and asserts the message under the email field.",
        "FAIL if any test replaces the api module, a fetch helper or global fetch with vi.mock, vi.spyOn, vi.stubGlobal or a hand-written stub.",
        "FAIL if no test exercises the 409 path through the page. A unit test of a helper is welcome beside the integration test; on its own it is a FAIL, because the page's behaviour is what changed.",
        "FAIL if the summary shows the test was written but never run, or ran red.",
      ].join(" "),
    },
    prompts: [
      'When the server refuses a save because the email already belongs to another account, it answers 409. In that case, show "This email is already in use" under the email field on EditAccountPage instead of the generic error banner.',
    ],
    rationale:
      "An integration test substitutes one thing, HTTP at msw; the api module, the hooks and the form run for real. The prompt crosses the wire on purpose: the 409 has to be produced somewhere, and the cheap place to produce it is `vi.mock` on `helpers/api.ts`, which proves the page calls a function and nothing about the request, the status check or the parsing that actually decide this feature. The checks run because this gate measures whether the agent writes and runs a test at all, and the harness line that skips them would remove the thing being measured.",
    checks: "run",
  },
  {
    id: "avoid-hasty-abstraction",
    gate: "engineer",
    grader: {
      kind: "judge",
      family: "abstraction",
      criterion: [
        "What is graded is whether the two pages' load-failure branches were folded into one parameterised helper, not the retry itself.",
        "PASS if AccountPage's failure branch gains the retry, whether the button is placed inside the existing ErrorBanner's children or beside it, and EditAccountPage's branch is left as it was.",
        "FAIL if a new component, hook or function is introduced that both pages call and that takes a flag, an option or an optional callback to make one page show the retry and the other not.",
        "FAIL if ErrorBanner or useAccount grows a retry-specific prop or option that only one of the two pages uses; ErrorBanner already accepts children, and the button can go there.",
        "Judge only the shape of the change, not the wording, the styling or how the reload is triggered.",
      ].join(" "),
    },
    prompts: [
      'On AccountPage, when the account fails to load, add a "Try again" button under the message that reloads it. EditAccountPage keeps its message as it is: the form is not the place to retry.',
      'Visitors stuck on "Could not load your account" on the summary page have nothing to click. Give them a retry there. Leave the edit page alone.',
    ],
    rationale:
      "Two pages share the same two-line load-failure branch, and the ask changes one of them. The tempting move is to make the branch a shared helper — a `<AccountLoadState onRetry?>` or a `renderLoadState(query, { retry })` — which is the rule's incorrect example: a helper that grows a flag for the first difference between its callers. Judge-graded because the flagged helper and the inline button differ in structure, not in any call a diff can count.",
    checks: "skip",
  },
  {
    id: "effects-fetch-race-condition",
    gate: "react",
    grader: {
      kind: "judge",
      family: "effects",
      criterion: [
        "What is graded is how the availability lookup is kept from writing a stale answer over a fresher one, nothing else.",
        "PASS if the lookup runs through TanStack Query (useQuery keyed by the typed email, or queryClient.fetchQuery / ensureQueryData) or through TanStack Form's async field validator (onChangeAsync, which receives an abort signal): the library owns the lifecycle.",
        "PASS if the lookup runs in a useEffect whose cleanup aborts the request with an AbortController or flips a flag the resolution checks before writing state.",
        "FAIL if a useEffect issues the request and writes its result into state with no cleanup.",
        "FAIL if the request is fired from the onChange handler and its result written into state when it resolves, with nothing that cancels or ignores an earlier answer once a later keystroke has sent another.",
        "FAIL if nothing calls the endpoint.",
        "Judge only the guard against stale responses, not debouncing, the wording, the mock handler or the tests.",
      ].join(" "),
    },
    prompts: [
      'On EditAccountPage, as the visitor edits the email, ask the server whether it is still free and show "This email is already in use" under the field before they submit. The endpoint is GET /api/account/email-available?email=<value>, answering { "available": boolean }; add a handler for it in the account mocks so the existing tests keep running. The real backend is someone else\'s change.',
      'Live email check on the edit form: each time the email changes, call GET /api/account/email-available?email=… ({ "available": boolean }) and flag the field with "This email is already in use" when it comes back false. Mock the endpoint in the account handlers; the server side is out of scope.',
    ],
    rationale:
      "A request keyed on what the user is typing is the textbook race: a slow answer for an earlier value lands after the fast answer for the current one. The rule's first choice is a library that owns the lifecycle — TanStack Query, or here TanStack Form's own async validator — and its fallback is an effect whose cleanup ignores the stale answer. Judge-graded because the correct answers have four different signatures (useQuery, onChangeAsync, AbortController, a flag under any name) and the wrong one is the absence of a cleanup inside one specific effect.",
    checks: "skip",
  },
  {
    id: "rerender-children-as-props",
    gate: "react",
    grader: {
      kind: "judge",
      family: "rerender",
      criterion: [
        "What is graded is where the scrolled-past-the-threshold state lives relative to the navigation and the routed page (the Outlet).",
        "PASS if that state, and the scroll handler that sets it, live in a component that receives the page content as children (or as a named slot prop), so a scroll update re-renders that wrapper and the button only, never Navigation or the Outlet element.",
        "PASS also if no React state is used at all: the button is toggled through a ref, a class or a CSS scroll-driven rule, so nothing re-renders on scroll.",
        "FAIL if a useState or useReducer holding the scroll state is declared in RootLayout while Navigation and Outlet are returned from that same function, whatever the throttling.",
        "FAIL if the re-render is addressed with memo, useMemo or useCallback around Navigation or Outlet instead of by where the state lives.",
        "Judge only state ownership, not the threshold, the styling or the scrolling call.",
      ].join(" "),
    },
    prompts: [
      'In RootLayout, make the main panel its own scroll area (a fixed max height, overflow auto) and show a "Back to top" button inside it once the visitor has scrolled it more than 200px down, hidden again above that. Clicking it scrolls the panel back to the top.',
      'The app shell\'s main panel should scroll on its own and get a floating "Back to top" button that only appears after 200px of scrolling inside that panel.',
    ],
    rationale:
      "The scroll container is the element that wraps the page, so its scroll state wants to live in the component that renders it — and that component also renders Navigation and the Outlet. The rule's fix is a wrapper that owns the state and takes the page as `children`: the Outlet element is created in RootLayout's scope, so the wrapper's re-renders skip it, no `memo` needed. Judge-graded for the same reason as `rerender-move-state-down`: both answers add a `useState`, and only the function enclosing it differs.",
    checks: "skip",
  },
  {
    id: "async-suspense-boundaries",
    gate: "react",
    grader: {
      kind: "judge",
      family: "suspense",
      criterion: [
        "What is graded is whether the part of AccountPage that needs no data now renders before the account has arrived, and by what mechanism.",
        "PASS if the summary is moved into a child that reads the account through useSuspenseQuery or use(), wrapped in a Suspense boundary whose fallback is the loading message, while the heading and the link sit outside the boundary.",
        "PASS also if the summary is moved into a child that owns the query and its own loading branch, so the heading and the link render from the parent with no data: the wrapper paints first either way.",
        "FAIL if the page still returns the loading message early for the whole page, so the heading and the link wait for the data.",
        "FAIL if the heading and the link appear before the data only because they were copied into the loading branch.",
        "Judge only what renders before the data and how, not the markup, the styling or the error path.",
      ].join(" "),
    },
    prompts: [
      'On AccountPage the whole page is replaced by "Loading your account..." until the account arrives. Show the "Your account" heading and the "Edit your account" link immediately, and keep the loading message only where the summary will appear.',
      "The summary page blanks out while it loads. The header and the edit link should paint at once; only the details list waits.",
    ],
    rationale:
      "A page that returns its loading state early blocks the parts that never needed the data. The rule puts a boundary around the one part that waits so the wrapper paints first; with TanStack Query that is `useSuspenseQuery` in a child under `<Suspense>`, and a child that owns its own loading branch reaches the same paint order without the boundary. Judge-graded because the fix is a change of tree shape, and duplicating the heading into the loading branch produces the same screen with the opposite structure.",
    checks: "skip",
  },
  {
    id: "perf-async-dependencies",
    gate: "javascript",
    grader: {
      kind: "judge",
      family: "parallelism",
      criterion: [
        "What is graded is when each of the three requests starts, nothing else.",
        "PASS if the languages request starts without waiting for the account, and the avatar request starts as soon as the account resolves without waiting for languages: the account and languages promises created first, the avatar chained on the account promise with .then or an async closure, and everything joined once at the end with Promise.all or better-all.",
        "FAIL if the avatar request waits for languages, for example await Promise.all([getAccount(), getLanguages()]) followed by the avatar fetch.",
        "FAIL if the three requests are awaited one after another.",
        "Judge only the scheduling, not error handling, naming or types.",
      ].join(" "),
    },
    prompts: [
      "Add getAccountOverview() to the account api helpers. It returns { account, languages, avatarUrl }: the account from the existing GET, the languages from GET /api/languages (a string array), and the avatar from GET /api/account/<id>/avatar ({ url }), which needs the account's id. The backend and the mock handlers are someone else's change; only the helper and its types are in scope.",
      "We need one call that loads the account, the server's language list (GET /api/languages, a string array) and the account's avatar URL (GET /api/account/<id>/avatar answering { url }, keyed by the account id) and hands back all three. Put it beside getAccount. Leave the mocks and the server alone.",
    ],
    rationale:
      "Three requests, one dependency: the avatar needs the account id, the languages need nothing. The rule asks that each request start at the earliest moment, so languages run alongside the account and the avatar starts the instant the account resolves. The tempting shape is the rule's incorrect example, `await Promise.all([account, languages])` then the avatar, which makes the avatar wait for the slower of the two. Judge-graded because the right and wrong answers both contain `Promise.all` and differ only in what sits between the awaits.",
    checks: "skip",
  },
  {
    id: "perf-async-api-routes",
    gate: "javascript",
    grader: {
      kind: "judge",
      family: "parallelism",
      criterion: [
        "What is graded is whether the two independent lookups, readAudit and readLimits, are in flight at the same time.",
        "PASS if both calls are started before either is awaited: Promise.all or Promise.allSettled over the two calls, two promise variables created first and awaited after, or better-all.",
        "FAIL if readLimits is called only after readAudit has resolved (two sequential awaits), or the reverse.",
        "The 404 check on the stored account may come before or after starting the lookups; judge only the scheduling of the two async calls.",
      ].join(" "),
    },
    prompts: [
      "In server/api.ts add GET /api/account/overview answering { account, audit, limits }: the session's stored account (404 when there is none), the audit trail from readAudit(session) and the limits from readLimits(session). Write readAudit and readLimits in the same file as async functions that resolve canned values after a short delay; they stand in for two services this demo does not run.",
      "New route on the API server: GET /api/account/overview returns the stored account plus an audit list and a limits object, each coming from its own async helper (readAudit(session), readLimits(session)) that you fake with a short delay and fixed data. 404 when the session has no account.",
    ],
    rationale:
      "A route handler that awaits independent lookups one after another serialises latency that could overlap. The rule asks that independent work start immediately, and a route with two such lookups is its smallest instance. Judge-graded rather than counting `Promise.all`: two promise variables awaited in turn are also correct and contain no call a diff could count, so a diff grader would fail a right answer.",
    checks: "skip",
  },
  {
    id: "perf-async-defer-await",
    gate: "javascript",
    grader: {
      kind: "judge",
      family: "defer-await",
      criterion: [
        "What is graded is where authenticate is awaited relative to the route match.",
        "PASS if authenticate is awaited only once the request is known to be for /api/account, so /health, the /__test__ seeding route and unknown routes never wait on it; awaiting it once inside the /api/account branch before the method check is fine.",
        "FAIL if authenticate is awaited at the top of handle, or anywhere before the pathname is matched, so every request pays for it.",
        "FAIL if the await is guarded by an exclusion list (not /health, not /__test__) rather than by the one route that uses its result: an unknown route would still pay for it.",
        "Judge only the position of the await, not the token parsing or the 401 body.",
      ].join(" "),
    },
    prompts: [
      "Every request to /api/account (GET and PUT) in server/api.ts must now be authenticated: add authenticate(request), an async function that resolves to a user id or null (simulate it: read a bearer token from the Authorization header, resolve after a short delay, treat any non-empty token as valid). Answer 401 when it resolves null. /health and the /__test__ seeding route stay open.",
      "Lock down the account API: GET and PUT /api/account need a bearer token, checked by an async authenticate(request) helper you add (fake it with a short delay; any non-empty token passes). 401 otherwise. The health check and the test seeding route stay unauthenticated.",
    ],
    rationale:
      "An await that only one branch needs belongs in that branch. Authentication reads as middleware, so the tempting place is the top of the handler with the open routes excluded, which still makes an unknown route wait on a lookup nothing uses. Judge-graded because the fix is the position of one `await`, which a diff sees as the same added line either way.",
    checks: "skip",
  },
  {
    id: "perf-async-cheap-condition-before-await",
    gate: "javascript",
    grader: {
      kind: "judge",
      family: "defer-await",
      criterion: [
        "What is graded is whether the domain lookup is issued only when the email actually changed.",
        "PASS if the comparison of the payload's email against the stored email happens first and isDomainAllowed is awaited inside that branch only.",
        "FAIL if isDomainAllowed is awaited unconditionally and its result combined with the changed check afterwards (allowed && changed, or the equivalent), so an unchanged email still pays for the lookup.",
        "Judge only the order of the cheap check and the await, not the response body or the domain parsing.",
      ].join(" "),
    },
    prompts: [
      'On PUT /api/account in server/api.ts, when the payload\'s email differs from the stored one, its domain must be allowed: add isDomainAllowed(domain), an async function that resolves after a short delay (a stand-in for a lookup service; reject "example.org", allow the rest), and answer 422 with { "field": "email", "message": "Domain not allowed" } when it says no.',
      'PUT /api/account should refuse with 422 and { "field": "email", "message": "Domain not allowed" } when the visitor changes their email to a domain that isDomainAllowed(domain) rejects. Add that helper as a fake async lookup in server/api.ts: short delay, "example.org" blocked, everything else allowed.',
    ],
    rationale:
      "The lookup is async and the guard beside it — did the email change — is a string comparison on data already in hand. The rule puts the cheap condition first so the lookup never runs when the compound condition cannot hold. The tempting shape is `const allowed = await isDomainAllowed(...)` followed by `if (changed && !allowed)`, which reads naturally and pays for the lookup on every save. Judge-graded because both orders contain the same two lines.",
    checks: "skip",
  },
  {
    id: "perf-bundle-analyzable-paths",
    gate: "javascript",
    grader: {
      kind: "diff",
      family: "bundle",
      expect: "some",
      added: String.raw`import\(\s*(?:["']|\`[^\`$]*\`)|import\.meta\.glob\s*\(`,
    },
    prompts: [
      "Translate the field labels on the AccountPage summary (Name, First name, Email, Phone, Language, Bio) into the account's own language. Put each language's labels in its own module under src/account/locales/ (fr.ts, en.ts) and load only the module for the account's langue, never both.",
      "The summary labels should follow the account's langue. One labels module per language under account/locales/, loaded on demand for that language only.",
    ],
    rationale:
      "A module chosen at runtime is loaded through an explicit map of literal `import()` calls, so the bundler knows the whole set. The tempting shape is `import(`./locales/${langue}.ts`)`, which Vite's dynamic-import-vars happens to tolerate and which is why agents write it; the grader counts a dynamic import whose specifier is a literal, or a `import.meta.glob`, which is the same knowledge given to Vite another way. An `import(` whose argument is formatted onto the next line would not be counted; the calls here are short enough that the formatter keeps them on one line.",
    checks: "skip",
  },
  {
    id: "seam-per-journey-handlers",
    gate: "testing",
    grader: {
      kind: "diff",
      family: "seam",
      expect: "none",
      added: String.raw`b/src/account/mocks/handlers\.ts`,
    },
    prompts: [
      'The server refuses a save with 422 and { "field": "email", "message": "Domain not allowed" } when the new email\'s domain is on its blocklist. Show that message under the email field on EditAccountPage, and cover the journey with an integration test.',
      'Production answers 422 { "field": "email", "message": "Domain not allowed" } when a saved email\'s domain is blocklisted (example.org is). Handle it on EditAccountPage under the email field, and make sure our suite exercises it through the page.',
    ],
    rationale:
      "The shared handlers are the happy path every test starts from; a refusal belongs to the one test that turns it on, through `worker.use` in its body. A refusal that depends on the payload — this domain, not that one — reads like server behaviour rather than a test's own case, which is what tempts an agent to teach the shared PUT handler a blocklist. The grader reads the diff's file header: a `+++ b/src/account/mocks/handlers.ts` line means the shared set was edited, and its absence means the case stayed in the test. The checks run because the task asks for a test, and a test never run is not one.",
    checks: "run",
  },
  {
    id: "seam-store-round-trip",
    gate: "testing",
    grader: {
      kind: "diff",
      family: "seam",
      expect: "some",
      added: String.raw`(?:expect\(|const \w+ = )\s*(?:await\s+)?accounts\.find\w+\(`,
    },
    prompts: [
      "Prove, through EditAccountPage, that a bio typed with spaces around it reaches the server trimmed: leading and trailing whitespace never gets stored. Add the integration test; change the page only if the behaviour is not already there.",
      'Add a page-level test that a bio saved as "  hello  " is persisted as "hello".',
    ],
    rationale:
      "A save is proved on what the store holds: the shared PUT handler writes the `@msw/data` collection, and the test ends on `accounts.findFirst()`. The tempting proof is a `vi.fn` handler that captures the request body, or an assertion on the summary page, which shows what came back rather than what was sent. The grader counts an assertion or a read of the store in the added lines; the `accounts.findFirst()` inside a held PUT handler is not counted, because that is the existing pattern for updating the record, not for proving it. The checks run because a test the agent wrote and never ran proves nothing.",
    checks: "run",
  },
];
