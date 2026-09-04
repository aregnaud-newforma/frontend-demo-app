Modern JavaScript Preferences. When writing JavaScript, check every function you
produce against this table before finalizing. Each rule file carries the
incorrect/correct example and the gotchas.

**Check `requires:` first.** Every rule below declares the ECMAScript edition its
API landed in. Read the repository's `tsconfig.json` `lib` before applying one: a
rule whose `requires:` is above that `lib` does not apply here, and writing it
anyway produces code that does not compile. `lib` is set to what the browsers in
`browserslist` actually ship, so it is the floor twice over — nothing in a build
polyfills a missing method, and a dev server running esnext will happily run code
that throws in production. When a rule you want is out of reach, say so and offer
the polyfill rather than reaching for the API.

| Whenever you...                                   | Use                                     | Read                                                                 |
| ------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| iterate a large or infinite sequence              | Iterator helpers (`.map`/`.filter`/`.take`) | [modern-iterator-helpers.md](modern-iterator-helpers.md)         |
| wrap a NodeList, Set, or Map for array methods    | `Iterator.from(x)`                      | [modern-iterator-from.md](modern-iterator-from.md)                   |
| intersect, union, or diff two Sets                | native Set operations                   | [modern-set-operations.md](modern-set-operations.md)                 |
| concatenate iterators                             | `Iterator.concat(a, b)`                 | [modern-iterator-concat.md](modern-iterator-concat.md)               |
| count or cache in a Map                           | `getOrInsert` / `getOrInsertComputed`   | [modern-map-getorinsert.md](modern-map-getorinsert.md)               |
| sort, reverse, or splice an array you don't own   | `.toSorted()` / `.toReversed()` family  | [modern-array-tosorted.md](modern-array-tosorted.md)                 |
| call a function that may be sync, async, or throw | `Promise.try(fn)`                       | [modern-promise-try.md](modern-promise-try.md)                       |
| collect an async iterable into an array           | `Array.fromAsync(iterable)`             | [modern-array-fromasync.md](modern-array-fromasync.md)               |
| open a resource that needs cleanup                | `using` / `await using`                 | [modern-using-cleanup.md](modern-using-cleanup.md)                   |
| check whether a caught value is an Error          | `Error.isError(x)`                      | [modern-error-iserror.md](modern-error-iserror.md)                   |
| sum an array of floats                            | `Math.sumPrecise(values)`               | [modern-math-sumprecise.md](modern-math-sumprecise.md)               |
| encode or decode bytes as base64/hex              | `Uint8Array` `toBase64`/`fromHex` etc.  | [modern-uint8array-encoding.md](modern-uint8array-encoding.md)       |
| build a regex from user-controlled input          | `RegExp.escape(input)`                  | [modern-regexp-escape.md](modern-regexp-escape.md)                   |
| import JSON                                       | `with { type: "json" }`                 | [modern-json-import-attributes.md](modern-json-import-attributes.md) |
| import a large, rarely used module                | `import defer`                          | [modern-import-defer.md](modern-import-defer.md)                     |
