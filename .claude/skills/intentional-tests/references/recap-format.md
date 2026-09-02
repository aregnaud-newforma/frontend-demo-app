# The recap format

What step 9 of [`applying.md`](../applying.md) writes to the feature's `recap.md` at the end
of every run.

`recap.md` is the feature's **history**: one section per run, oldest first, each saying what
that run did and what it left. The plan says where the feature stands today; the recap says
how it got there. A run appends its section below the last and leaves every earlier section
exactly as it stands.

## The section

One H2 per run, headed with today's date in ISO form, and a suffix where the date alone
would not tell two runs apart:

```
## 2026-08-21
## 2026-08-21 — five unit use cases reverted
```

Under the heading, the H3s below, in this order, and no prose between the two: a summary line
would say what the H3s beneath it already say, and the two drift the first time one is edited.
A section with nothing to report is left out, except **Numbers** and **Commands**, which every
run carries. A run that applied no plan row — a conformance pass, harness work, a revert —
carries the same sections, and what it did instead reads under **What changed**.

### Bugs

**Bugs lead**, because a blind spot that went red is the run's most valuable output and it
reads as such or it reads as a footnote nobody acts on.

A list, one bullet per bug, opening with the bug in one bold sentence a developer can act on
without reading the rest — then what the code does, what the user loses, the file and line,
the write-up in `blind-spots.md` that carries it, and the row that holds its ⚠. As long as it
takes and no longer: a bug earns its lines by what has to be understood to fix it, and the
bold opener is what the reader scanning the section takes away.

A run that found none writes no Bugs section.

### Applied — &lt;level&gt;

One H3 per level this run touched, in cost order — `### Applied — Integration page`. A level
the run left alone gets no section.

Each holds the plan's own table for that level — its columns, its rows, its 🆕 marks — cut to
the rows this run merged and carried across as the plan wrote them. The developer reads the
recap against the plan, so a row that reads differently in the two reads as a row that moved.

At **Integration component** and **Unit** the first column after `File` is headed **Function**,
not `Use case`: below the page, a row names the component or helper under test, and the journey
it serves is the plan's `Page use case`. The pull request's recap heads those two levels the
same way.

### What changed

A run that applied no plan row writes what it did here: one entry per file it edited, saying
what moved and why. An apply run's edits read off its **Applied** tables, so it writes no What
changed section.

### Written, not run

Every row this run left ✍️, one line each: the row, the command that would run it, and the
precondition that was missing. A test nothing has executed is an open debt, and this is where
it stays visible.

Name beside them every ✍️ row this run turned ✅, so a debt reads as paid rather than as
vanished.

### Blind spots

The ones this run **closed**, each naming the test that holds it now. What stayed open is not
listed here — `plan.md`'s ranked list carries every open spot with what leaves it open, and a
second copy per run is a copy that goes stale the run after.

### Query handles

Every component whose markup the merge raised, with the rung it reached. No plan row carries
that edit, so this is the only place the developer reads it back.

### Numbers

The two blocks the pull request's own recap prints, in its shape — the developer reads the two
side by side, and one format across both is one format to learn:

```
**Coverage** - <scope>

| Statements | Branches |
| --- | --- |
| 84.52 -> 85.31 | 74.15 -> 76.32 |

**Test count per level**

| Level | Files | Cases |
| --- | --- | --- |
| E2E | 1 -> 1 | 1 -> 1 |
| Integration page | 1 -> 1 | 7 -> 2 |
```

Feature totals, not a row per file: which file moved and why is what the plan's rows say, and
a per-file table spends the section's whole budget on basenames. Where the two ends rest on a
different file set they are not comparable, and the block says so instead of printing an arrow
— `**Coverage** - not comparable: the baseline reading covers 208 file(s), this one 1592.`
Where a figure was never taken, it is left out rather than guessed at, and a level outside the
run's slice takes no row. A drop names the lines it falls on and whether the plan meant to
lose it.

Each run's figures are a delta against that run's own baseline over that run's own scope —
chaining them across runs gives a number nothing measured. The pull request reads
`docs/intentional-tests/<feature>/measurements.json` instead, which
[`applying.md`](../applying.md) § Step 6 defines: one entry per run, each holding that run's
own two readings whole, so a pull request can take the ends of the runs it added without
summing anything.

### Notes

What the next run needs and no plan row carries: a mock the merge kept and what holds it, a
seam the harness needed, a trap that fails silently, a precondition standing on data nobody
has confirmed yet.

A list of short elements, one bullet each — the thing, then why it stands, in as few lines as
it takes. Not prose: this is the section a developer scans before touching the feature again,
and a paragraph hides the one line that would have saved them the afternoon. What the run
applied is not repeated here; the **Applied** tables above carry it.

**Written when the run's section holds every H3 above that the run has something to report
under, appended below the last section, with every earlier section untouched.**
