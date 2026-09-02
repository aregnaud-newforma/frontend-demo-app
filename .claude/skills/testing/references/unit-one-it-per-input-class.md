---
title: One `it` per Input Class
impact: LOW
impactDescription: a red names the one class of input the helper stopped handling
tags: unit, input class, arrange-act-assert
---

## One `it` per Input Class

A helper distinguishes classes of input — each accepted shape, each rejection reason, each boundary. One `it` per class, named for the class and the value out, means a failure names exactly what broke. A test walking several classes fails on the first and hides the rest.

**Incorrect (several classes in one test):**

```ts
it("validates phones", () => {
  expect(parseFrenchPhone("0612345678").valid).toBe(true);
  expect(parseFrenchPhone("06 12 34 56").valid).toBe(false);
  expect(parseFrenchPhone("1612345678").valid).toBe(false);
  expect(parseFrenchPhone("06 12 34 AB 78").valid).toBe(false);
});
```

**Correct (one class each, Arrange / Act / Assert, the reason in the name):**

```ts
it("rejects a number that is too short as wrong_length", () => {
  // Arrange
  const input = "06 12 34 56";
  // Act
  const result = parseFrenchPhone(input);
  // Assert
  expect(result).toEqual({ valid: false, reason: "wrong_length" });
});

it("rejects a number missing its leading zero as invalid_prefix", () => {
  // Arrange
  const input = "1612345678";
  // Act
  const result = parseFrenchPhone(input);
  // Assert
  expect(result).toEqual({ valid: false, reason: "invalid_prefix" });
});
```

Assert the **whole** result — `toEqual({ valid: false, reason })` — rather than one property of it, so a changed reason is a red and not a silent drift.
