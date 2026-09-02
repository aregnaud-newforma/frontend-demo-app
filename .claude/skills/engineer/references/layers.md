---
title: Add a Layer Only for a Concrete Extension Point
impact: MEDIUM-HIGH
impactDescription: each layer adds a file, glue code, and another hop to trace per bug
tags: architecture, layers, indirection
---

## Add a Layer Only for a Concrete Extension Point

Layered, hexagonal, and onion architectures buy indirection: more files, more glue code, more disjoint traces per bug.

Pay that price when a concrete extension point needs it, and write the call directly until then.

**Incorrect (over-layered — three indirections to read one row):**

```ts
class UserRepository {
  find(id: string) {
    return db.query("...", [id]);
  }
}
class UserService {
  constructor(private repo: UserRepository) {}
  get(id: string) {
    return this.repo.find(id);
  }
}
class UserController {
  constructor(private svc: UserService) {}
  handle(id: string) {
    return this.svc.get(id);
  }
}
```

**Correct (direct — one place, until a real extension point justifies more):**

```ts
function getUser(id: string) {
  return db.query("select * from users where id = $1", [id]);
}
```
