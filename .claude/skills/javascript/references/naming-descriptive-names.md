---
title: Use Descriptive Names
impact: LOW-MEDIUM
impactDescription: code reads without decoding
tags: naming, variables, readability
---

## Use Descriptive Names

Name variables so they reveal why they exist, what they do, and how they are used — without a comment or a trip to the definition.

**Incorrect:**

```javascript
let daysSLV = 10
let y = new Date().getFullYear()
let ok
if (user.age > 30) {
  ok = true
}
const getThem = (theList) => {
  const list1 = []
  theList.forEach((x) => {
    if (x[0] === 4) {
      list1.push(x)
    }
  })
  return list1
}
```

**Correct:**

```javascript
const MAX_AGE = 30
let daysSinceLastVisit = 10
let currentYear = new Date().getFullYear()
const isUserOlderThanAllowed = user.age > MAX_AGE
const getFlaggedCells = (gameBoard) => {
  return gameBoard.filter((cell) => isCellFlagged(cell))
}
```

But don't pad names with words the context already provides:

**Incorrect:**

```javascript
const nameValue = 'T-Shirt'
const theProduct = {}
const product = {
  productId: 1,
  productName: 'T-Shirt',
  productPrice: 8.99,
}
```

**Correct:**

```javascript
const name = 'T-Shirt'
const product = {
  id: 1,
  name: 'T-Shirt',
  price: 8.99,
}
```
