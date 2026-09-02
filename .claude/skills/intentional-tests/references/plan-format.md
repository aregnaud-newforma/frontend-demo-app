# The plan format

What every step showing a plan puts in front of the developer, and what it writes to the
feature's `plan.md` once the gate closes. Three readers reach it: step 4 of
[`SKILL.md`](../SKILL.md) writes the plan to it, step 9 of
[`applying.md`](../applying.md) marks the same tables up as rows are applied, and step 1
reads an existing `plan.md` back in this format when a feature has been tuned before.

Print it **verbatim**, whichever of the three is showing it: every table, every row, and every
cell in full — the Covers cell of a settled row spelled out, not a phrase standing in for it.
A plan read back from `plan.md` matches the file on disk line for line. The developer is
reading to argue with the ledger, and a Covers cell is what there is to argue with; a
shortened one hides a settled row behind a paraphrase they cannot check.

**Shown when every row of every table is on screen and each cell reads as its source does.**

## The sections

A plan holds these, in this order, and nothing else: the **opening note**, the **balance**,
the **level tables**, the **legend**, the **ranked blind spots**, and the **dropped lines**.
Anything a run wants to write beyond them already has a file — the run's own history goes to
`recap.md`, a bug to `blind-spots.md`, a behaviour to `inventory.md` — so the plan stays the
ledger a developer argues rows against rather than the feature's diary.

## The opening note

One line under the title, and no more: the feature root the plan covers. Which use cases are
applied and which are left is not written here — the **Applied** column on every level table
already says it, row by row and with its date, and a prose summary beside it is a second place
to keep in step that drifts the first time a run marks one and forgets the other.

The note says where the feature stands today, never how it got there. What a row was before,
what a run reverted, which pass renamed a file — `recap.md` holds one section per run and is
where that reads back. What the scope excludes belongs to `inventory.md`, which carries the
census the exclusion was made against.

Then the **balance** — what the merge costs and buys at each level, above the tables that
justify it:

## Balance

| Level                 | Files before | Files after | Cases before | Cases after |
| --------------------- | ------------ | ----------- | ------------ | ----------- |
| E2E                   | 1            | 1           | 1            | 1           |
| Integration page      | 6            | 1           | 22           | 4           |
| Integration component | 2            | 1           | 5            | 2           |
| Unit                  | 3            | 1           | 14           | 1           |
| **Total**             | **12**       | **4**       | **42**       | **8**       |

**Before** is step 2's inventory, `## From the tests` only — its lines are the cases, their
distinct filenames the files, and the level of each is the tag its line carries. Blind spots
are not cases: `## From the code` lines have never been tests, and they land in the ranked
list below rather than in this table. **After** is the tables below — their rows are the
cases, the distinct files in the File column the files. Count all four columns off those two
sources.

## The level tables

One table per level, in **cost order**, one row per merged test.

### E2E

| File                  | Use case           | Kind       | Covers                                                                                                                                                                                 | Applied |
| --------------------- | ------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `e2e/profile.spec.ts` | Renaming a profile | Happy path | the whole journey against the real API: opens the profile, fills it the way a user fills it — name, title, contact email — saves, and reopens it to find every value the API gave back |         |

The same use case names a row here and a Happy path row below:
[the levels](levels.md) give the happy-path journey a row at both, on purpose,
not a row written twice.

An E2E **Covers** cell names the values the journey carries across the wire, because that is
what the row is for and what the developer weighs at the gate — each value added costs real
data on a real device. A cell that names none is a journey proving its navigation only.

### Integration page

| File                               | Use case           | Kind           | Covers                                                                           | Applied |
| ---------------------------------- | ------------------ | -------------- | -------------------------------------------------------------------------------- | ------- |
| `ProfilePage.integration.test.tsx` | Renaming a profile | Default render | the loaded profile: name, title and contact email in their fields, save disabled |         |
| `ProfilePage.integration.test.tsx` | Renaming a profile | Happy path     | renames and saves, back on the summary — save disabled in flight                 |         |
| `ProfilePage.integration.test.tsx` | Renaming a profile | Edge case      | the save fails: banner, edit intact, nothing persisted                           |         |
| `ProfilePage.integration.test.tsx` | Renaming a profile | Edge case      | the name is cleared: field flagged, nothing sent                                 |         |

### Integration component

| File                              | Function                | Kind       | Page use case      | Covers                                                  | Applied |
| --------------------------------- | ----------------------- | ---------- | ------------------ | ------------------------------------------------------- | ------- |
| `PhoneField.integration.test.tsx` | Entering a phone number | Happy path | Renaming a profile | types digits, sees them formatted, field marked valid   |         |
| `PhoneField.integration.test.tsx` | Entering a phone number | Edge case  | Renaming a profile | types an invalid number, sees why, field marked invalid |         |

### Unit

| File                 | Function                      | Page use case      | Covers                                 | Applied |
| -------------------- | ----------------------------- | ------------------ | -------------------------------------- | ------- |
| `phone.unit.test.ts` | Reading a French phone number | Renaming a profile | 6 accepted shapes, 7 rejection reasons |         |

## The columns

- **File** — where the merged test lands, named as it will be _after_ the merge (see
  [The levels](levels.md)): the existing file carrying its level's extension, or
  a name that does not exist yet, prefixed 🆕, where the level has no file to take the row.
  Read top to bottom, the column is the file list the apply run creates and renames — so a
  row whose file differs from where its lines live today states that move while the developer
  can still veto it.
- **Use case** — what the user is there to do, named as they would name it, on the E2E and
  Integration page tables. One use case spans as many rows as it took tests. A default-render
  row shared by use cases that reach the page the same way names them all, comma-separated,
  and merges with the first slice that reaches it.
- **Function** — the same column at **Integration component** and **Unit**, headed differently
  because a row there names the component or helper under test rather than a journey a user
  walks: the journey it serves is its **Page use case**. Heading both `Use case` reads as one
  column holding two unrelated things, and the developer weighing a component row against its
  page row cannot tell which is which. `recap.md` and the pull request's recap head those two
  levels the same way.
- **Kind** — happy path, or edge case, on the E2E and integrations levels only; the Integration
  page table adds **default render** ([the shape](shape.md) § Integration page only); the Unit
  table carries no Kind column. It rides above the merged `it` beside the use case —
  `// Use case: Renaming a profile — Happy path` — so the suite reads the row back.
- **Page use case** — the Integration page use case this row serves, on the Integration
  component and Unit tables only, named exactly as the Integration page table names it. A
  component and a symbol are named for what they _are_, while a page use case is named for
  what the user came to do, so **Function** and **Use case** read as unrelated work until this
  one joins them: it says which journey goes unprotected when this row is dropped, and which rows
  move together when a use case is applied, re-applied or reverted. Several page use cases
  reach the same row often enough — a validator behind three journeys — and they sit
  comma-separated in one cell. A row no page use case reaches takes `—`, and that is a claim
  worth arguing at the gate: either a page row is missing from the plan, or the row is
  protecting something outside this feature. The E2E table carries no **Page use case**
  column, because its rows share the page's own use-case name.
- **Covers** — the journey in one line: what the user does, and the states the test asserts
  on the way through.
- **Applied** — the last column, empty on every row an audit writes, marked by the apply run
  with one of the marks below, so the column read top to bottom says how much of the plan is
  done, how long ago, and what is still owed a run. The dropped list below carries the same
  last column, marked when the line it names is gone from the suite.

## The marks

Four marks, and this is where they are defined: every reader — the audit writing the plan,
the apply run marking it, the re-audit reading it back — takes them from here.

| Mark        | Means                                                                        | Where it goes                                       |
| ----------- | ---------------------------------------------------------------------------- | --------------------------------------------------- |
| ✅ `<date>` | Applied: the merged test ran green, as of that date                          | **Applied** cell                                    |
| ✍️ `<date>` | Written: the merged test is in the file, and nothing has run it yet          | **Applied** cell                                    |
| 🕒          | Stale: applied before the code moved                                         | second line of the **Applied** cell, under the ✅   |
| 🆕          | New: a file that doesn't exist yet, or an assertion the suite has never made | **File** cell, or inside a **Covers** cell          |
| ⚠           | Held back: the assertion waits on a bug, written up in `blind-spots.md`      | inside a **Covers** cell, on the assertion it holds |

**✅ against ✍️** is whether a command ran the row. A row a green run covered takes
`✅ 2026-08-17`; a row whose test is written but which no command that run ran reaches — an
E2E row whose preconditions could not be met — takes `✍️ 2026-08-17` instead. A ✍️ row a later
run's e2e command covers green trades it for a ✅ carrying that run's date: the row was applied
either way, and what changed is that something finally ran it. The dates drive no routing —
step 1 of [`SKILL.md`](../SKILL.md) re-audits on the presence of a `plan.md`, not on any date.

**One date per cell.** The **Applied** cell carries one mark and one date: the latest. A
re-apply, an amendment, or a ✍️ row a later run finally covers overwrites the date standing
there rather than lining up beside it. When a row went green before is read off `recap.md`,
which holds one section per run — the cell says only where the row stands today.

**🕒** marks every row of a **stale** use case — one whose newest ✅ predates a commit to the
feature's source — on a second line under the ✅ date: `✅ 2026-08-18<br>🕒 3 commits since`.
The ✅ date keeps its meaning, the day that row went green; the line beneath says how far the
code has moved on. A current row carries the ✅ alone, so 🕒 marks exactly the rows worth
re-auditing.

**🆕** prefixes every blind-spot assertion inside its Covers cell, and every File cell whose
file does not exist yet.

**⚠** prefixes an assertion its row cannot make yet, because the behaviour it would assert is
a bug: the row's test would pin what the code does today rather than what it should do. The
mark carries the bug's own heading in `blind-spots.md`, so the assertion and the write-up
reach each other — `⚠ the calendar's month and day names follow the app's language — bug, in
blind-spots.md`. Fixing the bug is the developer's call, and the assertion goes in on the run
after they take it.

Where a re-audit finds the code behind a merged test has grown — a branch the journey now
runs through, a state it now reaches — that row loses its ✅ and takes the new assertion into
its **Covers** cell, marked 🆕. The apply run then reads it as a merged test to extend rather
than a file to write.

### The legend

Beneath the last table, one line per mark the plan actually carries, worded exactly:

```
✅ <date> — applied: the merged test ran green, as of that date.
✍️ <date> — written: the merged test is in the file, and nothing has run it yet.
🕒 — stale: applied before the code moved; the ✅ date is when it last went green.
🆕 — new: a file that doesn't exist yet, or an assertion the suite has never made (blind spot).
⚠ — held back: the assertion waits on a bug, written up in blind-spots.md.
```

## The ranked blind spots

A **ranked blind spots** list sits beneath the legend, in the loudness order step 2's code
census ranked them in. **Every blind spot the plan holds takes a line here** — the ones a row
closes and the ones no row can — so the list read top to bottom is the whole of what green
has never touched. Each line names the assertion, then either the row it lands in or what
leaves it open:

```
1. the expired-session banner never appears — ProfilePage.integration.test.tsx, "Renaming a profile" (edge case)
2. the Cancel row steps aside for the Android keyboard — left open: a layout branch no journey can assert without pinning layout
```

Write the ranking down here: the tables run in cost order, so if the loudness order lives
only in that census's head it dies at the gate. The apply run works down this written list.

Then the dropped lines with their reasons, carrying the same **Applied** column.
