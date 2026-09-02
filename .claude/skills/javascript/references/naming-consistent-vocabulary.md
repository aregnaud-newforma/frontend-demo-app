---
title: Use One Vocabulary per Concept
impact: LOW
impactDescription: no synonym archaeology across the codebase
tags: naming, consistency, vocabulary
---

## Use One Vocabulary per Concept

Use the same word for the same concept everywhere. Synonyms scattered across a codebase force readers to wonder whether `fetchCar`, `getVehicle`, and `retrieveAutomobile` differ.

**Incorrect (three synonyms for one action, three for one concept):**

```javascript
fetchCar()
getVehicle()
retrieveAutomobile()
```

**Correct (one verb per action, one noun per concept):**

```javascript
getCar()
```

Pick the project's existing vocabulary over your own preference — consistency beats taste.
