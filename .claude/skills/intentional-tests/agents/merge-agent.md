# Merging one plan's rows

You were dispatched to **merge** one plan's approved rows into tests. Your prompt names the
feature's `plan.md`, the rows of the slice this run covers, the feature's `inventory.md`, and the
dialect file `project-setup.md` resolved to. Write the tests, prove they run, and return the
report at the bottom of this file. Dispatch nothing.

Only the rows your prompt names are yours — one page use case's slice, spanning as many
levels as the plan gives it. Every other row of the plan stays
exactly as it is, and so does the scaffolding behind it.

A row already marked **✅** or **✍️** in its **Applied** cell is a **re-apply**: its merged
test already stands in the file its row names and the scaffolding behind it is gone. Rewrite
that test to the shape and the dialect as they read today — structure, queries, mounts,
naming: and a red here means the rewrite broke the test, not the code. Fix the rewrite.

## Read these first

Two files hold what a merged test looks like, and both are read before a line is written:

- **The shape** — every rule a merged test follows: [`shape.md`](../references/shape.md). Each
  of its sections binds to a level, so a row is written to the rules for its own level and every
  broader scope above it — a journey for E2E and integration rows, an arrival for a default
  render row, a granular case for unit rows.
- **The dialect** your prompt names. It supplies the APIs the shape names — the mount, the
  query ladder, the action API, the test-double API, the e2e runner — and a worked
  scaffolding-to-workflow example in this target's own code.

## Open on the renames

Each row's **File** is the name its test ends up under, so `git mv` every file whose current
name differs from the one the plan gave it, and create the ones prefixed 🆕 — the destinations
are approved, and moving first means the merge writes into the file it will ship in.

Where a file also holds scaffolding for a use case this run leaves standing, the rename is a
**split** instead: the merged tests go to the suffixed name, and the scaffolding stays behind
on the bare name it already has. Two files, one subject:

```
CreateFieldReportScreen.integration.test.tsx   the tests this run merged
CreateFieldReportScreen.test.tsx               the cases still waiting on a deferred use case
```

Each carries the setup its own tests need, so neither reads the other. The plan's **File**
column names the suffixed destination on every row — the bare name is where a case waits, not
where one lands, so it lives in `inventory.md` and nowhere else.

## Write the tests

Each group of journey rows becomes one test: one setup, then as many actions and assertions
as the journey needs, with the states the scaffolding mounted separately — loading, in-flight,
validation — becoming assertions _at the moment the journey passes through them_. A unit row
and a **default render** row are not journeys: each is written the way the shape's own section
for it says rather than folded into one.

The scaffolding stays on disk while you work — deleting it is the thread's next step, not
yours — so expect the behaviour you merge to be covered by both the old scaffolding and your
new test for now, and leave the old file alone unless a rename or a split moves it.

## Prove they run

Run the test runner over the files you wrote — **one command, all their paths, not the whole suite** — plus the static-check command; the manifest or agent instructions name both. E2E runs in its own process against a real API; where it can't run here, say so and leave those rows to the thread.

**Red is yours to fix before you return.** The shape and the dialect are in your context and
they are in nobody else's, so a merged test handed back red is one the thread has to repair
without either.

## The report

The tests themselves are the hand-off; the report carries what no file records. Return, and
nothing else:

- **Per merged test** — its file, its use case, and the `inventory.md` lines it closes, each
  named `<file.ext>:<line>` as that file names them. This is what the thread writes
  dispositions from, so a line you merged and left unnamed reads as a line nobody covered.
- **Every rename, split and creation** you performed, old name to new.
- **Every module mock the scaffolding held**: gone, or kept — and a kept mock names the row
  that kept it.
- **Every component you gave a query handle**, with the rung it reached. No plan row carries
  that edit and no file records it, so this is the only place it survives.
- **Whatever ran red and stayed red**, with the command and the shortest failing line.

**Done when every row of the slice is a merged test in the file its **File** column
names, following every rule the shape binds to that row's level and
the APIs the dialect supplies;
every file the plan renamed or split stands at its new name; and the runner and the static
checks are green over what you wrote.**
