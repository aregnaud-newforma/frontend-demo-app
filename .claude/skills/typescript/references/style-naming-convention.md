---
title: TypeScript Naming Conventions
impact: LOW
impactDescription: predictable type-level names
tags: typescript, naming, conventions, generics
---

## TypeScript Naming Conventions

- **UpperCamelCase (PascalCase)** for classes, types, and interfaces: `MyClass`, `MyInterface`
- **ALL_CAPS** for constants and enum values: `MAX_COUNT`, `Color.RED`
- **`T` prefix** on type parameters inside generic types, functions, or classes: `TKey`, `TValue`

```ts
type RecordOfArrays<TItem> = Record<string, TItem[]>;
```
