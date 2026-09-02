---
title: Name Functions with Verbs
impact: LOW
impactDescription: call sites state their intent
tags: naming, functions, verbs, readability
---

## Name Functions with Verbs

A function's name should be a verb or an action phrase, clearly indicating the underlying intent — and the intent of its arguments.

**Incorrect (nouns hide what happens):**

```javascript
function user(id) {
  return database.find(id)
}
function validation(email) {
  return /\S+@\S+\.\S+/.test(email)
}
function data(orders) {
  return orders.filter((order) => order.status === 'paid')
}
```

**Correct:**

```javascript
function getUser(id) {
  return database.find(id)
}
function isValidEmail(email) {
  return /\S+@\S+\.\S+/.test(email)
}
function getPaidOrders(orders) {
  return orders.filter((order) => order.status === 'paid')
}
```

Predicates read best as `is`/`has`/`should` phrases returning booleans.
