---
title: Keep Comments Concise and Unabbreviated
impact: LOW
impactDescription: comments that get read
tags: comments, readability, abbreviations
---

## Keep Comments Concise and Unabbreviated

Only use the necessary level of detail — over-detailed comments are never read. And avoid abbreviations: they shorten the sentence but defeat its purpose of conveying a clear message.

**Incorrect (too much detail):**

```javascript
// Retrieve a list of user objects asynchronously by invoking a database query
async function getUsers() {
  // ...
}
```

**Correct (what matters, nothing else):**

```javascript
// Retrieve a list of users from the database
async function getUsers() {
  // ...
}
```

**Incorrect (abbreviated):**

```javascript
// regEx, viz.
```

**Correct:**

```javascript
// Regular Expressions (regEx)
```
