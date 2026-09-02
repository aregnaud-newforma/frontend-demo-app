---
title: Design APIs for Change
impact: HIGH
impactDescription: a surface that cannot absorb a new need breaks every caller
tags: api-design, props, hooks, exports
---

## Design APIs for Change

Here "API" means any interface surface, not just the network boundary between frontend and backend. A component's props, a hook's signature, a helper's parameters, an exported module: each is an API.

Assume consumers will need to:

- Move, copy, or paste parts of the code.
- Rename things.
- Unify special cases into a reusable helper, or unwind an abstraction back into specific cases.
- Add a hack, optimize a bottleneck, or throw a part away and start over.
- Trace cause and effect, fix a bug, and review the fix.

A great API does not just let developers fall into the pit of success. It helps them stay there as the code changes. It is optimized for change.

**Incorrect (positional booleans — every new need breaks every caller):**

```ts
function createUser(name: string, isAdmin: boolean, sendEmail: boolean) {}

createUser("Ada", true, false); // what do true and false mean here?
```

**Correct (options object — tolerates growth, reads clearly, renames stay local):**

```ts
function createUser(options: {
  name: string;
  isAdmin?: boolean;
  sendEmail?: boolean;
}) {}

createUser({ name: "Ada", isAdmin: true });
```
