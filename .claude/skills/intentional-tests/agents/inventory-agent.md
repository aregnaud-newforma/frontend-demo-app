# Taking inventory: one census

You were dispatched to run **one census** of the inventory — your prompt names which, the tests
census or the code census. Run that census and write its lines yourself. Dispatch nothing,
and read no file but the ones named here and in your prompt.

Return the path you wrote and the done criterion of your census, held or not held — no
count, and no list of what you wrote. `inventory.md` is what every later step reads, so a
figure in your report is one the plan could be counted off instead of off the file.

## The line format

Both censuses land in one file — the feature's `inventory.md` — under `## From the tests` and
`## From the code`, one line per behaviour:

```
## From the tests
<file.ext>:<line>  [<level>]  <behaviour, in the user's terms>

## From the code
<file.ext>:<line>  <behaviour, in the user's terms>
```

Both also write into a third section, `## Census`: a fenced block holding **every file the
census read**, one repo-relative path per line, sorted, your census's files merged into what
is already there rather than replacing it.

````
## Census

```
e2e/src/features/<journey>.spec.ts
src/ui/<feature>/forms/<Form>.tsx
```
````

Those two lists above hold **findings**; this one holds the **sweep**. A file read and found
clean earns no behaviour line, so without this block it is indistinguishable from a file
nobody opened. Step 6 measures over this list, so it carries the files outside the feature
folder that the journey crosses, and the Detox specs no coverage report can ever hold.
Paths, not basenames: a basename names no file the tools can find.

The tests census carries one field more; everything else is the same shape on both sides,
which is what makes step 3 a diff rather than an interpretation. The behaviour is what pairs
across the two, never the tag.

**Name a file entirely, extension included** — `EditAccountPage.integration.test.tsx:59` —
here, in the plan, and in the report. A bare `EditAccountPage` names neither the file nor its
cost. The suffix states the level only once the merge has given the file one; until then the
tag carries it.

**The user's terms, not the code's** — "the save button is unusable while the request is in
flight", not "sets disabled". Every later step reads from these lines, and step 8 closes
against them. A line about a helper's own branches is the exception, and it is written in the
developer's terms for whoever changes that helper: the symbol, the input class, the value
back — "`parsePhone` returns null for an empty string".

**Scope** is the one your prompt names, and your census covers all of it.

An `inventory.md` already on disk is **updated in place**, your census of it, rather than
written again. Five moves, and every line takes one: a behaviour the suite still
holds keeps its wording and takes its current `file:line` and tag; a behaviour that has gone comes
out; a behaviour the changes brought in goes in; a line an earlier run closed keeps the
disposition and the merged test it names; and **a line outside the scope your prompt names keeps
its wording, its `file:line` and its disposition exactly as it stands** — you read none of its
files, so its absence from your census says nothing about it. That last move is what makes a
narrowed scope safe: without it, every line the other use cases hold reads as a behaviour that
has gone, and the census prunes the ledger it was sent to update. The file is the feature's
standing map of what is covered, and it outlives the session that wrote it.

## The tests census: what the tests cover

Read every test file covering the scope, and write one line per test case under
`## From the tests`.

Read the whole scope before judging any of it: merging needs the list at once, and deciding
test by test is how coverage leaks.

**Tag each line with its level** — `[E2E]`, `[Integration page]`, `[Integration component]`,
`[Unit]`. Read [`levels.md`](../references/levels.md) for the four and for how to read one off
a file's subject where the filename does not carry it. Step 4 counts the balance's **before**
columns off these tags, so a line left untagged is a case that lands in no level.

**Done when every test file covering the scope has been read, every test case in it has
a tagged line under `## From the tests`, and every file read is a path under `## Census`.**

## The code census: what the code does

A **blind spot** is behaviour the code has that no test exercises. The tests census listed
what the suite checks; here you list what the code actually does, in the same shape and the
same user's terms. Read `## From the tests` back from `inventory.md` first — it is what every
line below is weighed against.

Read every file in the scope, not just the files a test happens to import.

### The four probes

In order — the first is the cheapest and finds the most.

1. **Every string a user can see** — messages, labels, fallbacks, button text, empty
   states. Each is behaviour: the code can put it on screen. The standard find is a
   validation message that lives only in a schema — the schema proves the message
   exists, nothing proves a field is wired to it.
2. **Every branch that changes what renders** — the `if`s, ternaries and `&&`s in a
   component, and each state a hook can return. Every arm is somewhere a user can land.
3. **Every exported symbol that is complex or widely shared.** A pure function with real
   branching that many modules import, untested, is a unit blind spot. A component
   mounted by more than one screen, untested on its own, is an Integration component
   blind spot. A thin wrapper, or a symbol used in one place, is not — leave it to the
   integration test that already crosses it.
4. **Every value the request carries.** Read the payload the scope submits — its DTO, its
   schema, its request body — and list the fields a user supplies. A field no `[E2E]` line of
   the tests census carries has never crossed the real seam, and
   [`levels.md`](../references/levels.md) holds what that leaves unproved. It is a blind spot,
   and it earns a line however much page-level coverage the field already has. Name the field
   and the request it belongs to.

A blind spot inherits the level of the journey it joins, so leave that to step 3.

### What earns a line

One test decides it:

> **If this broke, the suite stays green.**

Write that sentence about the behaviour. If it does not hold, the behaviour is already
covered and belongs to the tests census's list, not this one.

Then apply the exclusions, unchanged: the table is in
[`drop-reasons.md`](../references/drop-reasons.md). A probe surfacing a behaviour does not
make it worth covering.

### Output

Write survivors under `## From the code`, ranked by **loudness**: what the user loses while
the suite stays green, loudest first. Every later step reads this order back — step 4 writes
it into the plan, and step 9 works down it — so rank the whole list rather than leaving it
in reading order.

**Done when every user-visible string, every rendering branch, every complex or shared
exported symbol, and every user-supplied value the scope's requests carry is either written
under `## From the code` in loudness order, or excluded by the test above — and every file
read is a path under `## Census`, the clean ones included.**
