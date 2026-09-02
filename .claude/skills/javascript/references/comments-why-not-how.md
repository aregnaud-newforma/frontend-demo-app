---
title: Code Tells How, Comments Tell Why
impact: LOW-MEDIUM
impactDescription: comments carry information the code cannot
tags: comments, readability, documentation
---

## Code Tells How, Comments Tell Why

The code itself should describe how it works; a comment earns its place by saying why it's there in the first place. A comment that restates the line below it is noise.

**Incorrect (restates the code):**

```javascript
const p = 3.14 // Initiate the value of the variable p
const circumference = 2 * p * 10 // Multiply the value p into 20
```

**Correct (adds what the code cannot say):**

```javascript
const pi = 3.14 // Rounded value of Pi
const circumference = 2 * pi * 10 // Calculate the circumference of a circle with radius 10
```

Before writing a comment that explains *how*, try renaming or extracting until the code says it itself — then keep the comment only if a *why* remains.
