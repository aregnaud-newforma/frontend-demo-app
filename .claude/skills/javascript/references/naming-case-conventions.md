---
title: File and Identifier Case Conventions
impact: LOW
impactDescription: predictable names across the codebase
tags: naming, files, case, conventions
---

## File and Identifier Case Conventions

- **kebab-case** for file names: `my-component.ts`
- **camelCase** for variables and functions: `myVariable`, `myFunction()`
- **SCREAMING_SNAKE_CASE** for true constants: `MAX_AGE`

```javascript
// my-component.ts
const MAX_AGE = 30
let daysSinceLastVisit = 10
function getFlaggedCells(gameBoard) { /* ... */ }
```

Framework conventions override this file when they conflict (e.g., a framework requiring a PascalCase component file name).
