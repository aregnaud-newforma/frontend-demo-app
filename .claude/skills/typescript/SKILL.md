---
name: typescript
description: Use whenever declaring, changing, or reviewing TypeScript types — in .ts or React .tsx code: type vs interface, props, generics, unions, `any`, enums, namespaces, optional/readonly properties, return types, or throwing.
---

# TypeScript

Route to the reference that owns the question. Read that file before writing the
code - each one carries the decision procedure, not just examples.

Rules are grouped by prefix: `modeling-` (declaring the shape of data),
`derive-` (types built from other types), `safety-` (holes in the type net),
`modules-` (module boundaries), `style-` (readability conventions).

| Whenever you deal with a...                                       | Read                                                                                                   |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| new object type — `type` or `interface`                           | [references/modeling-type-vs-interface.md](references/modeling-type-vs-interface.md)                   |
| object type extending another, or an `&` intersection             | [references/modeling-interface-extends.md](references/modeling-interface-extends.md)                   |
| value that can be in one of several shapes, or a bag of optionals | [references/modeling-discriminated-unions.md](references/modeling-discriminated-unions.md)             |
| enum, or enum-like set of values                                  | [references/modeling-enums.md](references/modeling-enums.md)                                           |
| property you're about to mark optional with `?`                   | [references/modeling-optional-properties.md](references/modeling-optional-properties.md)               |
| object type property that may or may not be mutable               | [references/modeling-readonly-properties.md](references/modeling-readonly-properties.md)               |
| second type related to an existing one — derive it or decouple it | [references/derive-vs-decouple.md](references/derive-vs-decouple.md)                                   |
| `Omit` or `Pick` applied to a union type                          | [references/derive-omit-pick-unions.md](references/derive-omit-pick-unions.md)                         |
| `any` you're about to write, implicit or explicit                 | [references/safety-any.md](references/safety-any.md)                                                   |
| index into an object or array under `noUncheckedIndexedAccess`    | [references/safety-no-unchecked-indexed-access.md](references/safety-no-unchecked-indexed-access.md)   |
| code that throws, or an error you'd need a `try`/`catch` for      | [references/safety-throwing.md](references/safety-throwing.md)                                         |
| type you're importing                                             | [references/modules-import-type.md](references/modules-import-type.md)                                 |
| namespace, or global type declaration                             | [references/modules-namespaces.md](references/modules-namespaces.md)                                   |
| name you're giving a type, interface, type parameter, or constant | [references/style-naming-convention.md](references/style-naming-convention.md)                         |
| JSDoc comment on a function or type                               | [references/style-jsdoc-comments.md](references/style-jsdoc-comments.md)                               |
| function declared at the top level of a module                    | [references/style-return-types.md](references/style-return-types.md)                                   |
| component's props                                                 | [references/style-component-props.md](references/style-component-props.md)                             |
