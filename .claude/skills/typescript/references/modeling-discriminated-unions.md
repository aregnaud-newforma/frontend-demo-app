---
title: Model Alternate Shapes as Discriminated Unions
impact: MEDIUM
impactDescription: impossible states become unrepresentable
tags: typescript, unions, discriminated-unions, modeling
---

## Model Alternate Shapes as Discriminated Unions

Proactively use discriminated unions to model data that can be in one of a few different shapes — and to prevent the "bag of optionals" problem.

**Incorrect (allows impossible states — success with an error, data while loading):**

```ts
type FetchingState<TData> = {
  status: "idle" | "loading" | "success" | "error";
  data?: TData;
  error?: Error;
};
```

**Correct (each state carries exactly its own fields):**

```ts
type FetchingState<TData> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: TData }
  | { status: "error"; error: Error };
```

The same shape fits events crossing environment boundaries:

```ts
type UserCreatedEvent = {
  type: "user.created";
  data: { id: string; email: string };
};

type UserDeletedEvent = {
  type: "user.deleted";
  data: { id: string };
};

type Event = UserCreatedEvent | UserDeletedEvent;
```

Handle them with a `switch` on the discriminant — TypeScript narrows each branch:

```ts
const handleEvent = (event: Event) => {
  switch (event.type) {
    case "user.created":
      console.log(event.data.email);
      break;
    case "user.deleted":
      console.log(event.data.id);
      break;
  }
};
```
