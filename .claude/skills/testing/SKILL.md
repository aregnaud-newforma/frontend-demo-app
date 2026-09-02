---
name: testing
description: Use when writing, editing, or reviewing any test while building a feature — a page or component integration test, a unit test for a helper or hook, an msw handler, a factory, or an e2e spec. Triggers on tasks that add or change behaviour and need proof it works, on a failing test, or on a question of which tier a test belongs in.
metadata:
  version: "1.0.0"
---

# Testing

Comprehensive Testing guideline for React applications. Each category has a **guide file**
carrying the decision procedure and routing to **rule files** with
incorrect/correct examples for individual patterns.

## When to Apply

Reference these guidelines when:

- Adding behaviour to a page, a component, a hook or a helper and proving it
- Deciding whether something needs a test at all, and at which tier
- Reaching for `vi.mock`, `vi.fn`, `act`, `setTimeout`, `delay()` or `data-testid`
- Writing an msw handler, a factory or a seed
- Writing or extending an e2e spec

## Rule Categories by Priority

| Priority | Category          | Impact        | Rule prefix | Guide (read first)                                        |
| -------- | ----------------- | ------------- | ----------- | --------------------------------------------------------- |
| 1        | Levels            | HIGH          | `level-`    | `references/level-no-test-for.md` (single rule, no guide) |
| 2        | The seam          | HIGH          | `seam-`     | `references/seam.md`                                      |
| 3        | Mount and queries | HIGH          | `mount-`    | `references/mount.md`                                     |
| 4        | File shape        | MEDIUM-HIGH   | `shape-`    | `references/shape.md`                                     |
| 5        | Fixtures          | MEDIUM        | `fixture-`  | `references/fixtures.md`                                  |
| 6        | Unit tests        | MEDIUM        | `unit-`     | `references/unit.md`                                      |
| 7        | E2E               | MEDIUM (rare) | —           | `references/e2e.md` (guide only, no rule files)           |

## How to Use

Read the category **guide first** — it carries the decision procedure and a
per-rule table routing to the rule files the situation touches. Each rule file
contains impact level, why it matters, an incorrect example, and a correct
example. When you already know the rule you need, find it by prefix:
`references/<prefix>*.md`.

Writing one integration test crosses most categories — a page test is at least
the seam, Mount, File shape and Fixtures. The tier decides which guides apply:
`integration` reads the seam, Mount, File shape and Fixtures;
`unit.` reads Unit tests; `e2e/*.spec.ts` reads E2E.

## Where the pieces already live

The infrastructure the guides name is built. Import it; write none of it again.

| Piece                                              | Where                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Integration page mount                             | `renderRoute(path)` from `@testing/render`                                                       |
| Integration component mount                        | `renderComponent(ui)` from `@testing/render`                                                     |
| Queries and user actions                           | `screen`, `within` from `@testing-library/react`; `userEvent` from `@testing-library/user-event` |
| The msw server a test overrides                    | `server` from `@testing/server` — `server.use(...)`                                              |
| A held answer                                      | `deferred()` from `@testing/deferred`                                                            |
| A vertical's default handlers and store            | `<vertical>/mocks/handlers.ts`, `<vertical>/mocks/db.ts`                                         |
| A vertical's factories and seeds                   | `<vertical>/mocks/db-utils.ts`                                                                   |
| Test lifecycle (server listen, reset, store clear) | `vitest.setup.ts` — already wired, nothing per file                                              |
| E2E session and seed                               | `e2e/session.ts`                                                                                 |

A vertical with no `mocks/` folder yet gains one the first time a test needs a
handler — modelled on `src/account/mocks/`.
