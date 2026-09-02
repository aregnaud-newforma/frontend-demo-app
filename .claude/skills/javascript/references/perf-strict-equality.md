---
title: Use Strict Equality and Boolean Shorthand
impact: LOW-MEDIUM
impactDescription: removes coercion surprises in comparisons
tags: javascript, conditionals, equality, booleans
---

## Use Strict Equality and Boolean Shorthand

Always compare with `===`/`!==`. Loose equality coerces operands and produces surprises (`'' == 0`, `null == undefined`).

**Incorrect:**

```javascript
password == confirmPassword
```

**Correct:**

```javascript
password === confirmPassword
```

Corollary: never compare a boolean to `true`/`false` — use the value directly. Only do this when the value is a real boolean, not possibly `undefined` or `null`.

**Incorrect:**

```javascript
if (isValid === true) { /* ... */ }
if (isValid === false) { /* ... */ }
```

**Correct:**

```javascript
if (isValid) { /* ... */ }
if (!isValid) { /* ... */ }
```
