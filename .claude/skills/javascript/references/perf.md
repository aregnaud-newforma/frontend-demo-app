Performance rules, routed by impact. Work the table top-down: async waterfalls
dominate real latency (network round trips), micro-optimizations only matter on
a measured hot path or a large collection. Default style still wins elsewhere —
see the boundary notes in [perf-declarative-transforms.md](perf-declarative-transforms.md).

| Impact      | Whenever you deal with a...                                       | Read                                                                                     |
| ----------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| CRITICAL    | sequence of independent `await`s                                  | [perf-async-parallel.md](perf-async-parallel.md)                                         |
| CRITICAL    | mix of dependent and independent async steps                      | [perf-async-dependencies.md](perf-async-dependencies.md)                                 |
| CRITICAL    | API route or server handler chaining fetches                      | [perf-async-api-routes.md](perf-async-api-routes.md)                                     |
| HIGH        | `await` earlier than its result is used                           | [perf-async-defer-await.md](perf-async-defer-await.md)                                   |
| HIGH        | async flag checked alongside a cheap synchronous condition        | [perf-async-cheap-condition-before-await.md](perf-async-cheap-condition-before-await.md) |
| HIGH        | dynamic import or asset path built from a variable                | [perf-bundle-analyzable-paths.md](perf-bundle-analyzable-paths.md)                       |
| MEDIUM-HIGH | array/object comparison that could bail on length first           | [perf-length-check-first.md](perf-length-check-first.md)                                 |
| MEDIUM      | non-critical work running during page load or interaction         | [perf-request-idle-callback.md](perf-request-idle-callback.md)                           |
| MEDIUM      | scroll/touch/wheel event listener                                 | [perf-client-passive-event-listeners.md](perf-client-passive-event-listeners.md)         |
| LOW-MEDIUM  | repeated `.includes`/`.find` membership checks                    | [perf-set-map-lookups.md](perf-set-map-lookups.md)                                       |
| LOW-MEDIUM  | repeated lookup of items by key in a loop                         | [perf-index-maps.md](perf-index-maps.md)                                                 |
| LOW-MEDIUM  | chain of `.map`/`.filter` passes over a large collection          | [perf-combine-iterations.md](perf-combine-iterations.md), [perf-flatmap-filter.md](perf-flatmap-filter.md) |
| LOW-MEDIUM  | loop or transform that keeps working after the answer is known    | [perf-early-exit.md](perf-early-exit.md)                                                 |
| LOW-MEDIUM  | property access repeated inside a loop body                       | [perf-cache-property-access.md](perf-cache-property-access.md)                           |
| LOW-MEDIUM  | `RegExp` constructed inside a loop or hot function                | [perf-hoist-regexp.md](perf-hoist-regexp.md)                                             |
| LOW-MEDIUM  | equality check or boolean conversion                              | [perf-strict-equality.md](perf-strict-equality.md)                                       |
| LOW-MEDIUM  | hand-rolled loop where a declarative chain reads clearer          | [perf-declarative-transforms.md](perf-declarative-transforms.md)                         |
| LOW         | min/max found by sorting                                          | [perf-min-max-loop.md](perf-min-max-loop.md)                                             |
| LOW         | compound conditional read as one expression                       | [perf-named-conditions.md](perf-named-conditions.md)                                     |
| LOW         | implicit type coercion                                            | [perf-explicit-coercion.md](perf-explicit-coercion.md)                                   |
| LOW         | `&&` guard chain for nested property access                       | [perf-optional-chaining.md](perf-optional-chaining.md)                                   |
