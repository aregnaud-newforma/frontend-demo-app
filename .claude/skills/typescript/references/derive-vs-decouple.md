---
title: Derive Related Types, Decouple Unrelated Ones
impact: MEDIUM
impactDescription: changes ripple exactly where they should
tags: typescript, derived-types, omit, coupling
---

## Derive Related Types, Decouple Unrelated Ones

Are the two types so related that updates to one must ripple to the other? Derive. Are they unrelated enough that coupling them creates work later? Decouple.

**Correct — decouple (separate concerns):**

```ts
// User is a data type; AvatarImage is a UI concern. They evolve independently.
export type User = {
  id: string;
  name: string;
  imageUrl: string;
  email: string;
};

type AvatarImageProps = {
  imageUrl: string;
  name: string;
};
```

**Correct — derive (one source of truth):**

```ts
// Decoupling these would mean adding every new User field twice
type UserWithoutId = Omit<User, "id">;

const updateUser = (id: string, user: UserWithoutId) => {
  // ...
};
```

**Correct — derive from a runtime constant:**

```ts
const albumTypes = {
  CD: "cd",
  VINYL: "vinyl",
  DIGITAL: "digital",
} as const;

type AlbumType = (typeof albumTypes)[keyof typeof albumTypes];
```

Deriving from a union? `Omit` and `Pick` misbehave there — see [derive-omit-pick-unions.md](derive-omit-pick-unions.md).
