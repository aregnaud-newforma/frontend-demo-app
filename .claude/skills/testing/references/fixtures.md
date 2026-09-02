## Fixtures

A test's data comes from the vertical's **Fishery factory** in
`mocks/db-utils.ts` — `Factory.define<T>`, exported as `<name>Factory`, faker
underneath — and reaches the store through a **seed** function beside it:
`seedAccount(overrides)` builds a record and puts it in the `@msw/data`
collection the handlers read.

Three moves, one rule each:

- **Build, never write a literal record.** A hand-written object goes stale the
  day the schema gains a field; the factory is the one place that knows what
  valid is. [fixture-factory-over-literal.md](fixture-factory-over-literal.md)
- **Override only the field the journey turns on.**
  `seedAccount({ telephone: null })` for the missing-phone case, and nothing
  else — the rest stays random, which is how a test stops depending on a value
  it never meant to assert. [fixture-override-what-turns-on.md](fixture-override-what-turns-on.md)
- **Assert against what the factory returned.** `toHaveValue(account.nom)`,
  never the string you happened to type. The factory hands the record back so
  the assertion and the seed cannot disagree.
  [fixture-assert-against-built-value.md](fixture-assert-against-built-value.md)

## Shapes that come in several forms

A value the app transforms — a phone typed, stored and displayed differently —
gets one helper returning every form together, so a test feeds one and asserts
another without re-deriving it through the parser under test:
`createFrenchPhone()` returns `{ formatted, national, e164 }`.

## Values that must not collide

Faker will hand out the same email twice. A field a test looks a record up by
goes through an `UniqueEnforcer`, in the factory, once — `createEmail()` — rather
than being hoped unique at each call site.

## A new vertical

The first test that needs a handler gives the vertical its `mocks/` folder,
modelled on `src/account/mocks/`: `db.ts` (the collection under a Zod schema),
`handlers.ts` (the shared set over it), `db-utils.ts` (factories and seeds).
The new store is cleared beside `accounts.clear()` in `vitest.setup.ts`.

## Per-rule references

| Whenever you deal with a...                                     | Read                                                                             |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| object literal standing in for a record                         | [fixture-factory-over-literal.md](fixture-factory-over-literal.md)               |
| `build({...})` or `seed({...})` setting more than the case needs | [fixture-override-what-turns-on.md](fixture-override-what-turns-on.md)          |
| assertion on a string that also appears in the setup            | [fixture-assert-against-built-value.md](fixture-assert-against-built-value.md)   |
