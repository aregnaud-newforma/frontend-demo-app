## The Shape of a Test File

Every integration file is built the same way, so a merge later combines tests
rather than rebuilding them. Top to bottom:

1. **Imports**, then a block comment naming the level — the two integration
   levels share a suffix, so the file spells it out:

   ```tsx
   /*
    * Integration: page
    */
   ```

2. **The setup function** — `render<ComponentName>`, see `mount.md`.

3. **The tests, flat.** Each `it` at the top level, no `describe`, no
   `beforeEach`. One journey per test; a second setup is a second `it`.
   [shape-flat-file.md](shape-flat-file.md)

Each test, top to bottom:

- **A name that states the journey**, or the arrival — "rejects the form when
  every field is invalid and sends nothing"; "shows every field seeded from the
  stored account". [shape-name-states-journey.md](shape-name-states-journey.md)
- **Given / When / Then** comments marking where one leg ends and the next
  begins, with every intermediate state — loading, in flight, flagged —
  asserted where it happens rather than in a test of its own.
  [shape-given-when-then.md](shape-given-when-then.md)

## Isolation

Each test seeds its own state in its own body — `await seedAccount()` — and
depends on nothing another test left. `vitest.setup.ts` clears the store and
resets the handlers after every test, and each mount builds a fresh query client
and router, so state cannot survive; a test that only passes in file order is
reaching for state it never seeded.

## Scaffolding that still merges

While building, the file may hold several narrow tests of one use case — the
loading state, the seeded values, the disabled button. Each still opens on its
own `Given` and its own seed, so the later merge reads them as legs of one
journey rather than as tests leaning on each other.

## Per-rule references

| Whenever you deal with a...                                   | Read                                                                   |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `describe`, `beforeEach`, or a variable shared between tests  | [shape-flat-file.md](shape-flat-file.md)                               |
| test name                                                     | [shape-name-states-journey.md](shape-name-states-journey.md)           |
| body with several actions, or an intermediate state to prove  | [shape-given-when-then.md](shape-given-when-then.md)                   |
