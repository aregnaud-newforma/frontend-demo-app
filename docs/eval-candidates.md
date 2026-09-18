# Eval candidates

Every skill rule no linter can fully measure, and whether its eval should use a
deterministic grader or an LLM judge.

Source: the `Coverage` column of
`BIMTrackJsLibraries/packages/oxlint-config/docs/lint-coverage.md`. This file is
the extract of that column, not a second source: when the two disagree, fix the
coverage doc and regenerate this one.

## What is in, what is out

**In.** Rules the coverage doc marks `Grader`, `Judge`, `Scanner + Grader`, or
`Lint + …`. For the `Lint + …` rows a linter owns one half and the eval owns the
other; the **Lint owns** column says which half is already covered, and **Eval
checks** says what remains untested.

**Out.**

- 48 rules marked `Lint` only. `yarn verify` covers them.
- 10 rules marked `Build`, `Manual` or `Flaky`. Not lintable either, but not
  eval candidates: they need an APK, a profiler, or the doc itself says the
  grader would be unreliable.
- 6 rules whose grader would only repeat the linter:
  `composition-over-inheritance`, `context-provider-hook-shape`,
  `hooks-over-legacy-patterns`, and the effects, hooks and patterns prose on a
  named effect function, the `use` prefix, and `cloneElement`.

The **Completed** column is ticked once a task for the rule exists in `evals/tasks.ts`. Four tasks in that file have no row here because their rule is lint-covered or undeclared in the coverage doc: `rerender-derived-state-no-effect`, `effects-reset-state-with-key`, `effects-dom-sync-is-valid`, `seam-msw-over-module-mock`.

## Where this file departs from the coverage doc

- **`modern-*` rules.** The doc says `Grader` ("the API appears"). That holds
  only when the fixture's `tsconfig` lib allows the API. This repo sits at
  ES2023, so `modern-set-operations` had to become a judge: the right answer is
  to decline the API and say why. Grader when the precondition passes, judge
  when the eval tests the `requires:` gate.
- **`level-no-test-for`.** The doc says `Grader`. "Asserts a library's own
  behaviour" is a semantic call. Judge.
- **`installing-libraries`, `bundle-library-size`.** The doc says `Grader`.
  Split: `package.json` untouched is a grader; "reported the size and asked
  first" lives in the transcript, so judge.
- **`effects-reset-state-with-key`.** The doc says `Lint`. This repo judges it,
  because the absence of an effect is not the presence of a `key`.
- **`effects-fetch-race-condition`.** The doc says `Grader`. Judged: the correct answers have four signatures (`useQuery`, TanStack Form `onChangeAsync`, `AbortController`, a flag under any name) and the wrong one is a missing cleanup inside one effect.
- **`avoid-hasty-abstraction`, `rerender-children-as-props`, the four `perf-async-*` rules.** The doc says `Grader`. Judged: each is a question of which function encloses a call or where an `await` sits, and the right and wrong diffs add the same lines.

Every "X appears" grader maps onto the `diff` grader in `evals/grading.ts` with
an `added` regex and `expect: "some"`. Every "no X" grader is the same with
`expect: "none"`.

## Engineer

| Rule                      | Severity    | Lint owns                          | Eval checks                                          | Verdict        | Completed |
| ------------------------- | ----------- | ---------------------------------- | ---------------------------------------------------- | -------------- | --------- |
| `api-design`              | HIGH        | parameter count                    | no boolean positional param; "optimized for change"  | Grader + Judge |           |
| `avoid-hasty-abstraction` | HIGH        | —                                  | no new shared helper, both call sites survive        | Judge          | ✓         |
| `layers`                  | MEDIUM-HIGH | import direction once layers exist | no repository/service/controller triad for one query | Grader         |           |

## React

| Rule                                             | Severity   | Lint owns                         | Eval checks                                             | Verdict | Completed |
| ------------------------------------------------ | ---------- | --------------------------------- | ------------------------------------------------------- | ------- | --------- |
| `effects-fetch-race-condition`                   | HIGH       | —                                 | cleanup aborts/ignores, or zero effect (TanStack Query) | Judge   | ✓         |
| `rerender-children-as-props`                     | HIGH       | —                                 | `children` added, no `memo`                             | Judge   | ✓         |
| `rerender-move-state-down`                       | HIGH       | —                                 | which component owns the state                          | Judge   | ✓         |
| `async-suspense-boundaries`                      | HIGH       | —                                 | boundary placement                                      | Judge   | ✓         |
| `state-no-impossible-states`                     | MEDIUM     | —                                 | `@ts-expect-error` fixture fails `tsc`                  | Grader  |           |
| `state-no-duplication`                           | MEDIUM     | —                                 | derived vs stored                                       | Judge   |           |
| `state-usereducer-dependent`                     | MEDIUM     | —                                 | one `useReducer`, not N `useState`                      | Grader  |           |
| `rerender-memo`                                  | MEDIUM     | memo hooks, compiler off only     | compiler on: no memo hooks added                        | Grader  |           |
| `rerender-memo-props-stability`                  | MEDIUM     | unstable props, compiler off only | compiler on: no defensive stabilisation                 | Grader  |           |
| `rerender-functional-setstate`                   | MEDIUM     | —                                 | setter gets an updater function                         | Grader  |           |
| `rerender-split-combined-hooks`                  | MEDIUM     | —                                 | hook split by concern                                   | Judge   |           |
| `rerender-defer-reads`                           | MEDIUM     | —                                 | read deferred to where used                             | Judge   |           |
| `rerender-use-deferred-value`                    | MEDIUM     | —                                 | `useDeferredValue` appears                              | Grader  |           |
| `rerender-transitions`                           | MEDIUM     | —                                 | `startTransition` appears                               | Grader  |           |
| `rerender-use-ref-transient-values`              | MEDIUM     | some ref misuse shapes            | value in a ref, no `setState` per change                | Grader  |           |
| `rerender-activity`                              | MEDIUM     | —                                 | `<Activity>` appears                                    | Grader  |           |
| `hooks-focused-api`                              | MEDIUM     | —                                 | hook surface                                            | Judge   |           |
| `context-split-value-api`                        | MEDIUM     | unstable context value            | value and API in two contexts                           | Grader  |           |
| `state-flat-structure`                           | LOW-MEDIUM | —                                 | state shape                                             | Judge   |           |
| `effects-effect-event`                           | LOW        | `exhaustive-deps` ≥ 6.1.0         | shapes that version misses                              | Grader  |           |
| `effects-effect-event-deps`                      | LOW        | same                              | same                                                    | Grader  |           |
| `effects-event-handler-refs`                     | LOW        | some shapes                       | `.current` read at call time, not render                | Grader  |           |
| `state-group-related`                            | LOW        | —                                 | grouping                                                | Judge   |           |
| `rerender-hoist-jsx`                             | LOW        | JSX as prop                       | static JSX hoisted out of render                        | Grader  |           |
| `rerender-usetransition-loading`                 | LOW        | —                                 | `isPending` drives UI, no boolean `useState`            | Grader  |           |
| effects prose: cleanup on subscribe              | —          | leaked web APIs                   | other subscriptions have a teardown                     | Grader  |           |
| effects prose: `useLayoutEffect` for DOM measure | —          | —                                 | `useLayoutEffect` appears                               | Grader  |           |
| effects prose: decision tree gate                | —          | five of seven branches            | zero `useEffect` added                                  | Grader  |           |
| patterns prose: control props                    | —          | —                                 | setter guarded by `!isControlled`                       | Grader  |           |
| state prose: immutable updates                   | —          | `react-hooks/immutability`        | mutations the rule misses                               | Grader  |           |
| state prose: type-of-state table                 | —          | —                                 | nuqs / Query / context / `useState` per fixture         | Grader  |           |
| context prose: before context                    | —          | —                                 | no `createContext` for three levels                     | Grader  |           |
| rerender prose: structure before memo            | —          | —                                 | `children` or state down, no `memo`                     | Grader  |           |

## React Native

| Rule                          | Severity | Lint owns                              | Eval checks                                                 | Verdict        | Completed |
| ----------------------------- | -------- | -------------------------------------- | ----------------------------------------------------------- | -------------- | --------- |
| `js-lists-flatlist-flashlist` | CRITICAL | literal `ScrollView` + `map` (scanner) | `FlashList`, `getItemType`                                  | Grader         |           |
| `bundle-barrel-exports`       | CRITICAL | `export *` barrels                     | concrete-file import past a named re-export barrel          | Grader         |           |
| `bundle-analyze-js`           | CRITICAL | —                                      | `date-fns`/`dayjs`, `@aws-sdk/client-*`                     | Grader         |           |
| `bundle-hermes-mmap`          | HIGH     | —                                      | `noCompress` in `build.gradle`                              | Grader         |           |
| `bundle-r8-android`           | HIGH     | —                                      | `minifyEnabled`, `shrinkResources`, no `-keep`              | Grader         |           |
| `bundle-tree-shaking`         | HIGH     | direct `Platform` import (scanner)     | Metro/Babel flags, `sideEffects: false`                     | Grader         |           |
| `bundle-native-assets`        | HIGH     | —                                      | `@2x`/`@3x`, `.xcassets`, Android untouched                 | Grader         |           |
| `js-react-compiler`           | HIGH     | components the compiler skips          | memo hooks deleted, not added                               | Grader         |           |
| `js-atomic-state`             | HIGH     | —                                      | state atomisation                                           | Judge          |           |
| `js-concurrent-react`         | HIGH     | —                                      | `useDeferredValue` feeding a `memo()` child                 | Grader         |           |
| `js-uncontrolled-components`  | HIGH     | —                                      | `defaultValue`, no `value`                                  | Grader         |           |
| `native-sdks-over-polyfills`  | HIGH     | banned polyfill and JS-stack imports   | swap target, `Intl` gaps kept                               | Grader         |           |
| `native-threading-model`      | HIGH     | —                                      | thread choice                                               | Judge          |           |
| `native-turbo-modules`        | HIGH     | —                                      | promise return, `invalidate()`                              | Grader         |           |
| `native-measure-tti`          | HIGH     | —                                      | mark + cold-start filter                                    | Grader         |           |
| `js-animations-reanimated`    | MEDIUM   | worklet and Reanimated 4 misuse        | `useSharedValue` + `useAnimatedStyle`, no `Animated.timing` | Grader         |           |
| `js-memory-leaks`             | MEDIUM   | web timers only                        | `addListener` paired with `.remove()`                       | Grader         |           |
| `native-view-flattening`      | MEDIUM   | —                                      | `collapsable={false}` on fixture's children only            | Grader         |           |
| `native-memory-leaks`         | MEDIUM   | —                                      | `weak`, `onDestroy()` removal, smart pointer                | Grader         |           |
| `native-memory-patterns`      | MEDIUM   | —                                      | pointer type expresses ownership                            | Grader         |           |
| `bundle-library-size`         | MEDIUM   | `moment`, full `lodash` (scanner)      | `package.json` untouched; size reported first               | Grader + Judge |           |
| `bundle-code-splitting`       | MEDIUM   | —                                      | no `React.lazy` under Hermes                                | Grader         |           |

## Javascript

All `modern-*` rows: grader only when the fixture's `tsconfig` lib allows the
API. When the eval tests the `requires:` gate, judge.

| Rule                                      | Severity    | Lint owns                 | Eval checks                                 | Verdict        | Completed |
| ----------------------------------------- | ----------- | ------------------------- | ------------------------------------------- | -------------- | --------- |
| `perf-async-dependencies`                 | CRITICAL    | —                         | independent calls in `Promise.all`          | Judge          | ✓         |
| `perf-async-api-routes`                   | CRITICAL    | —                         | no sequential `await` over independent work | Judge          | ✓         |
| `perf-async-defer-await`                  | HIGH        | —                         | `await` at use site                         | Judge          | ✓         |
| `perf-async-cheap-condition-before-await` | HIGH        | —                         | guard precedes `await`                      | Judge          | ✓         |
| `perf-bundle-analyzable-paths`            | HIGH        | —                         | static `import()` specifier                 | Grader         | ✓         |
| `modern-array-tosorted`                   | MEDIUM-HIGH | —                         | `toSorted` appears                          | Grader         | ✓         |
| `perf-length-check-first`                 | MEDIUM-HIGH | —                         | length check precedes work                  | Grader         |           |
| `installing-libraries`                    | MEDIUM      | undeclared import         | `package.json` untouched; asks first        | Grader + Judge |           |
| `modern-using-cleanup`                    | MEDIUM      | —                         | `using` appears                             | Grader         |           |
| `modern-regexp-escape`                    | MEDIUM      | —                         | `RegExp.escape` appears                     | Grader         |           |
| `modern-error-iserror`                    | MEDIUM      | —                         | `Error.isError` appears                     | Grader         |           |
| `modern-math-sumprecise`                  | MEDIUM      | `reduce` flagged only     | `Math.sumPrecise` chosen                    | Grader         |           |
| `perf-client-passive-event-listeners`     | MEDIUM      | —                         | `{ passive: true }`                         | Grader         |           |
| `perf-request-idle-callback`              | MEDIUM      | —                         | `requestIdleCallback` appears               | Grader         |           |
| `naming-descriptive-names`                | LOW-MEDIUM  | —                         | name quality                                | Judge          |           |
| `comments-why-not-how`                    | LOW-MEDIUM  | —                         | comment intent                              | Judge          |           |
| `modern-set-operations`                   | LOW-MEDIUM  | —                         | precondition checked, ES2023 here           | Judge          | ✓         |
| `modern-iterator-helpers`                 | LOW-MEDIUM  | —                         | `.map`/`.filter` on iterator, no array      | Grader         |           |
| `modern-iterator-from`                    | LOW-MEDIUM  | —                         | `Iterator.from` appears                     | Grader         |           |
| `modern-promise-try`                      | LOW-MEDIUM  | —                         | `Promise.try` appears                       | Grader         |           |
| `modern-map-getorinsert`                  | LOW-MEDIUM  | —                         | `Map.getOrInsert` appears                   | Grader         |           |
| `modern-import-defer`                     | LOW-MEDIUM  | —                         | `import defer` appears                      | Grader         |           |
| `modern-uint8array-encoding`              | LOW-MEDIUM  | —                         | `toBase64`/`toHex` appears                  | Grader         |           |
| `perf-index-maps`                         | LOW-MEDIUM  | repeated `Array.includes` | `Map` built once outside loop               | Grader         |           |
| `perf-hoist-regexp`                       | LOW-MEDIUM  | —                         | regex at module scope                       | Grader         |           |
| `naming-positive-booleans`                | LOW         | `is`/`has` prefix         | name not negated                            | Grader         |           |
| `naming-function-verbs`                   | LOW         | —                         | verb choice                                 | Judge          |           |
| `naming-consistent-vocabulary`            | LOW         | —                         | vocabulary                                  | Judge          |           |
| `comments-concise`                        | LOW         | —                         | brevity                                     | Judge          |           |
| `comments-no-dead-code`                   | LOW         | —                         | no comment body parses as JS                | Grader         |           |
| `modern-array-fromasync`                  | LOW         | —                         | `Array.fromAsync` appears                   | Grader         |           |
| `modern-iterator-concat`                  | LOW         | —                         | `Iterator.concat` appears                   | Grader         |           |
| `modern-json-import-attributes`           | LOW         | —                         | `with { type: "json" }` appears             | Grader         |           |
| `perf-named-conditions`                   | LOW         | —                         | extracted condition well named              | Judge          |           |

## Typescript

| Rule                            | Severity | Lint owns                             | Eval checks                          | Verdict | Completed |
| ------------------------------- | -------- | ------------------------------------- | ------------------------------------ | ------- | --------- |
| `modeling-interface-extends`    | MEDIUM   | —                                     | extends vs intersection              | Judge   |           |
| `modeling-discriminated-unions` | MEDIUM   | exhaustive `switch` once union exists | union carries a literal discriminant | Grader  |           |
| `derive-vs-decouple`            | MEDIUM   | —                                     | derive or decouple                   | Judge   | ✓         |
| `derive-omit-pick-unions`       | MEDIUM   | —                                     | `Omit`/`Pick` over re-declared shape | Grader  |           |
| `style-component-props`         | LOW      | readonly, prefix                      | boolean prop naming beyond prefix    | Judge   |           |

## Testing

| Rule                                 | Severity | Lint owns                       | Eval checks                                    | Verdict        | Completed |
| ------------------------------------ | -------- | ------------------------------- | ---------------------------------------------- | -------------- | --------- |
| `seam-per-journey-handlers`          | HIGH     | —                               | `handlers.ts` untouched, `server.use` in test  | Grader         | ✓         |
| `seam-held-answer`                   | HIGH     | `delay` from msw banned         | `deferred()`, assertion before `resolve`       | Grader         |           |
| `seam-store-round-trip`              | HIGH     | —                               | ends on `findFirst()`, not spy args            | Grader         | ✓         |
| `mount-setup-function`               | HIGH     | raw `screen.` in `it`           | one `render<X>` per file; verbs                | Grader + Judge |           |
| `mount-query-ladder`                 | HIGH     | test-id, container, node access | role/label query, fix in markup                | Grader         |           |
| `shape-flat-file`                    | MEDIUM   | hooks, nested `describe`        | one journey per `it`                           | Judge          |           |
| `level-no-test-for`                  | MEDIUM   | —                               | no test of required props or library behaviour | Judge          |           |
| `seam-fake-clock`                    | MEDIUM   | `vi.mock` on debounce module    | `shouldAdvanceTime`, `advanceTimers`           | Grader         |           |
| `mount-exact-names`                  | MEDIUM   | `exact: false`                  | `within(landmark)`, no indexed `getAllBy*`     | Grader         |           |
| `fixture-factory-over-literal`       | MEDIUM   | —                               | no record literal, `*Factory.build`            | Grader         |           |
| `fixture-override-what-turns-on`     | MEDIUM   | —                               | override has one key                           | Grader         |           |
| `fixture-assert-against-built-value` | MEDIUM   | —                               | no literal shared by seed and matcher          | Grader         |           |
| `unit-each-one-class-many-values`    | MEDIUM   | siblings pushed into `it.each`  | no description column                          | Grader         |           |
| `shape-given-when-then`              | LOW      | —                               | legs marked, single `it`                       | Grader         |           |
| `shape-name-states-journey`          | LOW      | title format                    | name states a journey                          | Judge          |           |
| `unit-one-it-per-input-class`        | LOW      | one `expect` per `it`           | one input class per `it`                       | Judge          |           |
| unit prose: AAA comments             | —        | —                               | three comments per `it`                        | Grader         |           |
| shape prose: level comment           | —        | —                               | file opens on `/* Integration: … */`           | Grader         |           |
| fixtures prose: unique values        | —        | —                               | `UniqueEnforcer` in factory                    | Grader         |           |
| e2e prose: happy paths only          | —        | —                               | no refusal asserted in `e2e/*.spec.ts`         | Grader         |           |
| e2e prose: every value crosses wire  | —        | —                               | every factory field filled and read back       | Grader         |           |
