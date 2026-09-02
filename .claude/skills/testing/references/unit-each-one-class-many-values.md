---
title: `it.each` Is for One Class, Many Values
impact: MEDIUM
impactDescription: a table stays a table; a row describing itself is a separate test
tags: unit, it.each, table
---

## `it.each` Is for One Class, Many Values

A table earns its place when every row runs the same act and the same assertion and only the value changes — the written forms a parser accepts, the strings that trim to empty. The row _is_ the value, and the name interpolates it. A row that carries a description of itself is a different input class wearing a table's clothes.

**Incorrect (rows that are separate tests):**

```ts
it.each([
  ["an empty bio is accepted", { bio: "" }],
  ["an empty telephone is accepted", { telephone: "" }],
  ["a malformed email is rejected", { email: "nope" }],
])("%s", (_, values) => {
  expect(accountSchema.safeParse({ ...valid, ...values }).success).toBe(/* ? */);
});
```

**Correct (one class — the accepted written forms — many values):**

```ts
it.each([
  { input: "06 12 34 56 78", e164: "+33612345678", national: "0612345678" },
  { input: "06.12.34.56.78", e164: "+33612345678", national: "0612345678" },
  { input: "+33 6 12 34 56 78", e164: "+33612345678", national: "0612345678" },
])("parses $input to $e164 / $national", ({ input, e164, national }) => {
  // Arrange: input is the written form this row parses
  // Act
  const result = parseFrenchPhone(input);
  // Assert
  expect(result).toEqual({ valid: true, e164, national });
});

it.each(["", "   "])("rejects %j as empty", (input) => {
  // Act
  const result = parseFrenchPhone(input);
  // Assert
  expect(result).toEqual({ valid: false, reason: "empty" });
});
```

The three rows of the incorrect example become three `it`s, each named in the developer's terms — [unit-one-it-per-input-class.md](unit-one-it-per-input-class.md).
