---
name: engineer
description: Use when making a design or architecture decision — adding a module or layer, choosing or unwinding an abstraction, deciding what to duplicate, where code should live, or how to shape a component's props, a hook's signature, or an exported API.
metadata:
  version: "1.0.0"
---

# Engineer

Design and architecture guidelines for this codebase: abstraction, API surfaces,
layering, and reuse across types. Each category is a **rule file** carrying the
decision procedure and incorrect/correct examples.

Every decision below is judged by **cognitive load**: the amount of context
required to complete a task.

- **Intrinsic:** inherent to the task. Cannot be removed.
- **Extraneous:** created by how the code is presented. Reduce it.

## Principles

These bear on every design decision:

- **Colocation.** Things that change together should live together — place code
  as close to where it is relevant as possible. Buys maintainability,
  discoverability, ease of use.
- **Deep modules.** A deep module exposes a simple interface over complex
  functionality; a shallow one has an interface nearly as large as what it does.
  Prefer fewer, deeper modules. When splitting a module makes each half's
  interface almost as big as its body, the split costs more than it buys.
- **Single responsibility.** A module should be responsible to one
  stakeholder — not "do one thing". Test: if a single change makes two
  different stakeholders complain, the responsibility is split. Judge by
  cognitive load, not by the "one thing" phrasing.

## When to Apply

Reference these guidelines when:
- Deciding whether repetition becomes an abstraction or stays duplicated
- Shaping an interface surface — component props, hook signature, exported function
- Adding a layer, service, repository, or wrapper
- Sharing behaviour across several types, or reaching for a class hierarchy
- Deciding where a new module lives

## Rule Categories by Priority

| Priority | Category | Impact | Rule file |
|----------|----------|--------|-----------|
| 1 | Abstraction | HIGH | [references/avoid-hasty-abstraction.md](references/avoid-hasty-abstraction.md) |
| 2 | API Design | HIGH | [references/api-design.md](references/api-design.md) |
| 3 | Layering | MEDIUM-HIGH | [references/layers.md](references/layers.md) |
| 4 | Reuse Across Types | MEDIUM | [references/composition-over-inheritance.md](references/composition-over-inheritance.md) |

## How to Use

Read the rule file that owns the question **before** writing the code — each one
carries the decision procedure, not just examples. Every rule file contains its
impact level, why it matters, an incorrect example, and a correct example. Each
category here holds a single rule, so there is no guide layer to read first;
route straight from the table.

One design decision often crosses several categories — extracting a shared
helper is at least Abstraction and API Design.
