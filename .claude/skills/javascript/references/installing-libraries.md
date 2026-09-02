---
title: Install Libraries via the Package Manager, Never by Hand
impact: MEDIUM
impactDescription: avoids stale versions from training data
tags: dependencies, package-manager, process
---

## Install Libraries via the Package Manager, Never by Hand

When installing a library, do not pick a version from your own training data — it has a cut-off date and is probably behind the latest developments. Never write a version into `package.json` manually; run the package manager so it resolves the latest version.

**Incorrect (version invented from memory):**

```jsonc
// package.json, edited by hand
"devDependencies": {
  "@typescript-eslint/eslint-plugin": "^6.0.0"
}
```

**Correct (resolver picks the current version):**

```bash
# pnpm
pnpm add -D @typescript-eslint/eslint-plugin

# yarn
yarn add -D @typescript-eslint/eslint-plugin

# npm
npm install --save-dev @typescript-eslint/eslint-plugin
```
