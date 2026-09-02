---
title: Don't Leave Commented-Out Code
impact: LOW
impactDescription: removes confusion with zero benefit
tags: comments, dead-code, version-control
---

## Don't Leave Commented-Out Code

Commented-out code adds confusion with no benefit — nobody knows why it's there or whether it's safe to delete. Version control already keeps the code that once was.

**Incorrect:**

```javascript
doStuff()
// doOtherStuff();
// doSomeMoreStuff();
// doSoMuchStuff();
```

**Correct:**

```javascript
doStuff()
```
