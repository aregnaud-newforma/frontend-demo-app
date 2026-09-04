---
name: react
description: Use when writing, editing, or reviewing any React code — components, hooks, JSX/TSX, state, effects, context, or re-render/performance work. Triggers on tasks involving components, custom hooks, state modeling, useEffect, context providers, or re-render optimization.
metadata:
  version: "1.0.0"
---

# React

React guidelines for this codebase: state modeling, effects, re-render work,
custom hooks, context, and component API patterns. Each category has a **guide
file** carrying the decision procedure and routing to **rule files** with
incorrect/correct examples for individual patterns.

## When to Apply

Reference these guidelines when:
- Writing new components or shaping a component's props
- Declaring state or modeling UI/server/URL/global state
- Writing or reviewing a `useEffect`
- Extracting or reviewing a custom hook
- Creating a context or shaping a provider
- Chasing a re-render or considering memoization

## Preconditions

Some rules only hold under a given React version, or depending on whether the
React Compiler runs. Those declare it as `requires:` in their frontmatter — check
it against `package.json` and the build config before applying the rule.

## Rule Categories by Priority

| Priority | Category | Impact | Rule prefix | Guide (read first) |
|----------|----------|--------|-------------|--------------------|
| 1 | Effects | HIGH | `effects-` | `references/effects.md` |
| 2 | State Modeling | HIGH | `state-` | `references/state.md` |
| 3 | Re-render Optimization | MEDIUM-HIGH | `rerender-` | `references/rerender.md` |
| 4 | Custom Hooks | MEDIUM | `hooks-` | `references/hooks.md` |
| 5 | Context | MEDIUM | `context-` | `references/context.md` |
| 6 | Component Patterns | MEDIUM | — | `references/patterns.md` (guide only, no rule files) |
| 7 | Async/Suspense | HIGH (rare) | `async-` | `references/async-suspense-boundaries.md` (single rule, no guide) |

## How to Use

Read the category **guide first** — it carries the decision procedure and a
per-rule table routing to the rule files the situation touches. Each rule file
contains impact level, why it matters, an incorrect example, and a correct
example. When you already know the rule you need, find it by prefix:
`references/<prefix>*.md`.

Writing one component typically crosses several categories — a component with
local state and a data fetch is at least States, Effects, and Re-renders.
