---
title: Avoid Uncommon Abbreviations
impact: LOW
impactDescription: removes guesswork from reading
tags: naming, variables, abbreviations, readability
---

## Avoid Uncommon Abbreviations

Uncommon abbreviations force every reader to guess. Spell names out.

**Incorrect:**

```javascript
const uIds = users.map((u) => u.id)
const convertPtC = (p, c) => {
  if (p.currency !== c) {
    return p.amount * convRate(p.currency, c)
  }
  return p.amount
}
```

**Correct:**

```javascript
const userIds = users.map((user) => user.id)
const convertPriceToCurrency = (price, toCurrency) => {
  if (price.currency !== toCurrency) {
    return price.amount * getConversionRate(price.currency, toCurrency)
  }
  return price.amount
}
```

Exception: `i`, `j`, `k` are fine as loop iterators — standard practice.

```javascript
for (let i = 0; i < cars.length; i++) {
  text += cars[i] + '<br>'
}
```
