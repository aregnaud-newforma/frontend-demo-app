## Unit Tests

A unit file proves a helper on its own terms: it calls the module directly, no
mount, no seam. It earns its place when the subject has **branches** — a
parser, a validator, a formatter — or is **shared** by more than one place.
A helper with one path, used by one page, is proved through that page.

The runner puts `*.unit.test.ts` in Node, so nothing in the file may touch the
DOM. A subject that needs a mount is not a unit.

Each `it`, top to bottom:

- **One input class per `it`** — each accepted shape, each rejection reason,
  each boundary the symbol distinguishes. [unit-one-it-per-input-class.md](unit-one-it-per-input-class.md)
- **A name in the developer's terms** — "rejects a number missing its leading
  zero as invalid_prefix": the input class in, the value out.
- **Arrange / Act / Assert**, the three phases marked as comments.

`it.each` is for **one class, many values**: every row runs the same act and the
same assertion, and only the value changes. A row that carries a description of
itself is a separate `it`. [unit-each-one-class-many-values.md](unit-each-one-class-many-values.md)

A `describe` naming the function under test is fine here — the file holds
several symbols of one module, and the name says which one a block proves.

## Per-rule references

| Whenever you deal with a...                                      | Read                                                                         |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| test covering two rejection reasons, or an accepted and a rejected shape | [unit-one-it-per-input-class.md](unit-one-it-per-input-class.md)     |
| `it.each` table, or a set of near-identical tests                | [unit-each-one-class-many-values.md](unit-each-one-class-many-values.md)     |
