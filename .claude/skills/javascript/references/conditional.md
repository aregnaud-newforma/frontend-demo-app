Good conditions read as a sentence: each clause named, each comparison exact, no
coercion the reader has to run in their head, and the preconditions out of the
way before the main path. Route by what you are about to write — each rule file
carries the incorrect/correct example:

| Whenever you deal with a...                                     | Read                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| compound conditional — several clauses in one `if`               | [perf-named-conditions.md](perf-named-conditions.md)             |
| equality check                                                   | [perf-strict-equality.md](perf-strict-equality.md)               |
| boolean compared against `true` or `false`                       | [perf-strict-equality.md](perf-strict-equality.md)               |
| implicit coercion, or a value used for its truthiness            | [perf-explicit-coercion.md](perf-explicit-coercion.md)           |
| `&&` guard chain walking into a nested property                  | [perf-optional-chaining.md](perf-optional-chaining.md)           |
| nested `if` wrapping the work the function actually does         | [perf-early-exit.md](perf-early-exit.md)                         |
