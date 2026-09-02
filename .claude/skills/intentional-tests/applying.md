# Applying the plan

Steps 5 to 9 — everything past the plan gate step 4 of [`SKILL.md`](SKILL.md) closed. The
levels are in [`levels.md`](references/levels.md) and the drop reasons in
[`drop-reasons.md`](references/drop-reasons.md); the approved plan is
`docs/intentional-tests/<feature>/plan.md`, carrying every disposition the ledger settled,
and the lines it has to close are in its `inventory.md`.

The plan settled the judgment, so an apply run needs less than the audit did: **Sonnet at
medium effort** carries these steps, and the merge agent is pinned to Sonnet where it is
dispatched.

It builds in two passes, and the order is what makes a red run mean something: step 7
merges only what the scaffolding already covered, so step 8 going green proves the merge lost nothing, and step 9 then adds
the blind spots on top.

Step 0 of `SKILL.md` settled the project's setup, so the first question this run puts is
the E2E use case.

Each of these steps opens on its banner, as `SKILL.md` § Say where you are says.

## Step 5: Choose the use cases

A **slice** is one run's work: one E2E use case and one Integration page use case, plus every
Integration component and Unit row that serves the page one. One slice merges per run; the
rest waits.

### Offer the use cases

Ask with `AskUserQuestion` once setup is behind you — two single-select questions in one call,
the **E2E** one first, then the **Integration page** one. Each carries one option per use case
in its own table, applied ones included. A table holding no row puts no question.

A use case whose rows all hold an empty **Applied** cell merges. One holding a **✅** or a
**✍️** row is a **re-apply**, and its option says so in three parts: that it is a re-apply,
the newest date its **Applied** cells carry, and what choosing it does — rewrite the tests
that stand there to the shape and dialect as they read today, against the same rows, for a
new date in those cells. A use case holding both kinds of row is a re-apply too: its applied
rows are rewritten and its empty ones merge in the same run.

A use case missing from a question's options is written into that question's `Other`. Past
four options, show the ones its table reaches first; `Other` takes the rest by name.

### Read the slice off the plan

The two answers name a use case each; the slice follows:

- **E2E** — every row whose **Use case** cell holds the E2E answer.
- **Integration page** — every row whose **Use case** cell holds the page answer.
- **Integration component and Unit** — every row whose **Page use case** cell names the page
  answer (the column [`plan-format.md`](references/plan-format.md) defines) — not the row's own
  **Function**. A cell with several names puts its row in each slice.

A component or unit row whose **Page use case** cell reads `—` belongs to no slice. Name it in
the recap with its cell's reason, so it returns to the gate rather than sitting unreachable.

### What the slice scopes

The slice's rows merge or re-apply, its lines close, its blind spots are step 9's. A slice
left standing keeps its tests and its open inventory lines.

A re-applied row has no scaffolding to delete and its inventory lines are already closed: what
remains is the rewrite, the commands green, and its **Applied** cell taking today's date.

A plan is **spent** once every use case of every table is applied.

**Done when the developer has answered every question this step put, and the slice holds the
chosen E2E use case's rows, the chosen Integration page use case's rows, and every Integration
component and Unit row whose **Page use case** cell names that page use case.**

## Step 6: Take the baseline

Measure coverage before editing a line: step 7 overwrites the only chance to see what the
scaffolding covered. Two scopes pull opposite ways here — **narrow what coverage reports,
run every test.**

Report over **the files listed under `## Census` in `inventory.md`**, wherever in the tree they
sit — the census has already walked the journey and written down every file it read, shared
components and navigators included, and those are the files a merge touches hardest. That block
is the list, and the only one: nothing here re-derives it, and nothing copies it anywhere else. Report over the
directories that hold them and the figure stops being about the feature: `src/ui/fieldReports`
sweeps in the attachments, preview and history screens, whose tests this feature never touches
and whose hundreds of unchanged cases bury the handful that moved. A file the census never
walked stays out of the figure even if its percentage moves — putting it in would make the
total answer a question nobody asked. Step 9 runs the whole suite, which is where a regression
outside the walked surface shows up; recap it there, by name, rather than folding it in here.

Run the whole suite meanwhile, every level in one invocation: a test living outside the feature
that mounts it counts towards these numbers, and filtering it out books a drop step 8 reads as
the merge's. Read the machine-readable summary, not the printed table, which hides files
already at 100% — the very files a merge is most likely to cost you. Keep the statement and
branch counts per file while you work: the recap names the files that moved, and the ledger
takes their sums. Where the project has no coverage provider, say so in the recap
and carry on.

Coverage counts lines executed, never assertions made, so a merged suite can hold it flat
while proving less. The closed inventory is the check that matters; this is the **second
opinion** on it, read into the recap for the developer to weigh against the ledger. The run
carries on whichever way the numbers move. E2E runs in its own process and lands in none of
it.

The baseline is read twice:

- **After step 8**, against "the merge lost nothing". A drop names the lines it falls on:
  recap those with the number and whether the plan meant to lose them — a delta the ledger
  accounts for reads very differently from one it does not.
- **After step 9**, where the blind spots are new ground and the number rises. A blind spot
  that moves nothing was already covered, so the recap flags it as a line the ledger may
  have miscalled.

### Write the reading down where a tool can read it

The recap's prose numbers are for the developer; the pull request's block is built from
`docs/intentional-tests/<feature>/measurements.json`, beside the plan. **Every** run appends
its own entry, carrying its own two readings — this step's `before`, and the `after` step 9
closes on. A feature is worked across several pull requests, and each one's block is built
from the runs that pull request added, so a run that skipped its entry is work no description
can report.

Open the entry now with what this step read:

```json
{
  "runs": [
    {
      "at": "2026-08-17T10:04:00Z",
      "sha": "cafcd7b53e1c3b2ea41ae6ce78a25fec0ea9fe6c",
      "before": {
        "counts": {
          "Integration page": { "files": 1, "cases": 23 },
          "Unit": { "files": 4, "cases": 24 }
        },
        "coverage": {
          "files": 28,
          "statements": [726, 868],
          "branches": [389, 548]
        }
      }
    }
  ]
}
```

`at` is what identifies a run, so it is written once here and never rewritten — the pull
request reads it to tell its own runs from the ones it inherited. `sha` is `git rev-parse
HEAD`.

The entry records **the reading, not the scope**: what the census walked is written under
`## Census` in `inventory.md`, and copying it here would give one list two owners and let them
drift. A file the census names and this reading does not carry is a file no test loads at all,
and the pull request says so by counting the two.

`coverage` is **one sum per metric over the whole reading**, `[covered, total]`, plus the
number of files it rests on. Covered and total rather than the percentage, because a total
over several files is the ratio of their sums: averaging percentages would weight a two-line
file like a two-hundred-line one. The percentage the summary prints is dropped — it is those
two numbers divided. The per-file breakdown is not kept: no reader has it, the pull request
prints one row, and the recap names the files that moved in prose.

Summing is where the honesty lives, so **read both ends over the same files** — the census
files the coverage report carries **at both SHAs**. A file this branch creates has no `before`
to compare against; leaving it in the `after` sum would credit the merge with surface that was
never uncovered. Drop it from both sums and let step 9's recap name it. `files` is what proves
it: the pull request compares the first run's `before` to the last run's `after`, and refuses
the arrow outright when the two counts differ, because nothing in the ledger can re-intersect
sums. A run that widens its census therefore re-reads both of its own ends over the wider list.

`counts` carries one entry per level — how many test files sit there and how many cases they
hold — over every test file the run touched. Classify each file first, by the rules below, and
write down the totals. Levels are `Unit`, `Integration page`, `Integration component`, `E2E`,
and `Scaffolding`.

A file whose name declares its level is read from that name. A file that predates the
discipline declares nothing — the first run over an existing feature meets a directory full of
them — and it is read instead from **what it is about**, which the repository states in the
subject's own name beside it: `__tests__/Foo.test.tsx` sits next to `Foo.tsx`.

| The subject is                                                    | Level                   |
| ----------------------------------------------------------------- | ----------------------- |
| a screen — named `*Screen`, or under `screens/`                   | `Integration page`      |
| a component — a subject compiled as `.tsx`                        | `Integration component` |
| a hook or a helper — named `use*`, or a subject compiled as `.ts` | `Unit`                  |

Read the subject, never the test's own machinery: a test is not a unit test for calling
`renderHook`, and a helper's test does not become an integration test for mounting a wrapper.
Where no subject file can be found beside the test, the test's own extension stands in for it —
a `.tsx` test mounts something, a `.ts` test does not. Reserve `Scaffolding` for a file that
lands at no level at all under those rules; it is a last resort, not the bucket every unnamed
file falls into. Calling a whole existing suite `Scaffolding` would make the pull request
report `Unit 0 -> 1`, as if the feature had no unit tests the day before.

**Done when the covered and total counts are summed over every file listed under `## Census`
that the coverage report carries at both ends, or the recap says the project has no coverage
provider — and this run's entry stands in `measurements.json` carrying that sum and its file
count as its `before`, beside the test count per level.**

## Step 7: Merge

The merge is a **dispatch**: a subagent reads the shape and the dialect, writes the merged
tests itself, runs them, and returns a report. The merge itself is written in
[`merge-agent.md`](agents/merge-agent.md), which is what the dispatched agent reads — this
thread does the dispatching, and never the writing.

The boundary buys two things. The shape and the dialect are hundreds of lines this thread
never has to hold, and the steps waiting behind this one — the deletion, the inventory, the
blind spots — are out of the merger's view, so the journeys get written rather than hurried
towards the next heading.

Dispatch once with the `Agent` tool, `subagent_type: "general-purpose"`, `model: "sonnet"`, for
the whole plan: renames and splits are file-wide, and a file carries rows of more than one
level. The prompt
carries the path to the feature's `plan.md`, every row of the slice step 5 settled, the path to the
feature's `inventory.md`, and the absolute paths to `merge-agent.md` and to the dialect file
`project-setup.md` names.

**The report is the hand-off.** It names the `inventory.md` lines each merged test closes,
which step 8 writes dispositions from, and the module mocks kept and the query handles
raised, which step 9 recaps — none of which any file records.

**Done when the report accounts for every row of the slice, the merged tests stand
in the files the plan's **File** column names, and the report carries nothing left red.** A
row missing from the report, or a red the agent handed back, sends that row round again.

## Step 8: Delete and close the inventory

Delete the scaffolding tests the slice replaced. A bare-named file emptied by
that deletion has nothing left waiting, so `git rm` it — the suffixed file is the subject's
only test now. Then run the project's test command over the whole suite — its package
manifest (`package.json`, `pyproject.toml`, `Makefile`) and its agent instructions
(`AGENTS.md`, `CLAUDE.md`) name it, so read it from there rather than guessing. One
invocation covers every level, and the coverage read this step owes comes out of that same
run wherever the runner collects it — a second invocation for the numbers buys nothing.
The static-check commands wait for step 9: this step deletes test files only.

Those commands do not reach the e2e directory — the runner keeps it outside — so an E2E row
needs its own. Check the chain `project-setup.md` recorded, and **build nothing, boot
nothing**: a build step or a device this run would have to start is a precondition that does
not hold. Name the one that is missing, carry on, and step 9 marks those rows for what they
are. A run that stops to build an app has turned a step of minutes into one of tens, so this
check costs seconds or it is being done wrong.

Where the chain does hold, run the e2e command the manifest names over the spec files this
run wrote — not the whole e2e suite — and over every **✍️** row this feature still carries,
whose specs an earlier run already wrote. It is the one moment a device is up, so it is the
only moment those rows can go green.

Write each disposition onto the line it settles — the merged test it landed in, or the drop
reason it went out on — and leave the line in `inventory.md`. A closed line is the record
that the behaviour is covered, and the next run reads it.

Write this reading into **this run's** entry in `measurements.json` — the one step 6 opened,
found by its `at` — as its `after`, in the same shape its `before` takes and **over the same
files**, so `files` reads the same on both ends. Earlier runs' entries are left exactly as they
stand.

```json
{
  "at": "2026-08-17T10:04:00Z",
  "sha": "cafcd7b5…",
  "before": { "counts": {}, "coverage": {} },
  "after": { "counts": {}, "coverage": {} }
}
```

A file this run renamed into its level — `useFieldReportsOptions.test.ts` becoming
`useFieldReportsOptions.unit.test.ts` — needs no record of the move: both readings count it at
the level it sat at when they were taken, so the cases move between levels and none appear from
nothing. Say what moved and why in the recap, where a reader will look for it.

**Done when every line the slice covers carries the disposition the approved plan
gave it, and that command is green, the e2e command included wherever it ran.** Report
the closed inventory, the coverage delta against the baseline, and the before/after test
count per level, in cost order. Name the slices left standing beside it, so a line still
open reads as one deliberately deferred.

## Step 9: Close the blind spots

Work the slice's blind spots down the plan's **ranked blind spots** list, in the
loudness order step 4 of `SKILL.md` wrote it in. Most land as one more assertion inside a
test step 7 just merged, mounting nothing new.

Run the files you touched as you go — a whole-suite run per blind spot pays minutes for an
assertion that mounted nothing new. Once the list is spent, run the whole suite again, then
the static-check commands, then the e2e command where step 8 could run it. **A blind
spot that goes red on its first run has found a bug** — the code does not do what the plan
said. It is a finding, not a broken test, and
quietly rewriting the assertion until it passes is how the finding gets lost. Take that
assertion back out, write the bug to the feature's `blind-spots.md` naming the behaviour it
contradicts and the test that would prove it, then carry on down the list: a bug blocks its
own blind spot, never the ones under it.

That whole-suite run is this run's last reading, so it overwrites the `after` step 8 wrote
into this run's entry, on the same terms.

**Done when every blind spot of that slice is either written and green, or carried to
`blind-spots.md` with what leaves it open — the bug it found, or the reason it waits — and
the whole suite, the static checks, and the e2e command wherever it ran, are green, and this
run's entry in `measurements.json` holds that reading as its `after`.** A blind spot from a slice nobody chose stays in the plan for
the next run.

Write the recap to `docs/intentional-tests/<feature>/recap.md`, in the format
[`recap-format.md`](references/recap-format.md) holds — one section per run, appended below
the last, with every earlier section left as it stands.

Then mark the plan, with the marks and the legend
[`plan-format.md`](references/plan-format.md) defines — which mark a row takes, and how its
date is written, are settled there. Every row this run applied keeps its place and takes
today's date in its **Applied** cell — the last column, which step 4 of `SKILL.md` leaves
empty — and so does every dropped line this run deleted. What this run settles is only which
rows a command reached: step 8's and step 9's runs, the e2e command among them wherever its
chain held.

Leave the plan's opening note and its balance table as the audit wrote them — the note names
the feature root only, and the balance table is what the merge was approved against. What this
run applied reads off the **Applied** column, and is written nowhere else in the plan.

The pull request's own recap is generated from those marks, not from this file:
`.github/skills/pr-description/scripts/intentional-tests-pr-recap.mjs` diffs the **Applied**
column against the merge base for its level tables. So the plan is marked before a description
is written, and a row this run applied but left unmarked is a row the pull request will not
mention.

It reads two more of the plan's sections the same way: the **Dropped** table, by its
`Line` / `Proves` / `Why it goes` columns, and **Ranked blind spots**, by its numbered lines —
the spot before the first em dash, the use case in double quotes, the test file in backticks
where one is named. Keep both shapes when editing them, or the pull request drops the section
silently rather than reporting a parse it never made.

Its numbers come from `measurements.json` alone — it measures nothing itself. It takes the
runs the ledger did **not** already hold at the merge base, which are the ones this branch
added, and reads the first one's `before` against the last one's `after`. A run that wrote no
entry is a run the pull request cannot see.

A plan whose every row carries a mark, ✅ or ✍️, is spent, and it stays on disk as the
feature's settled ledger.
So do `inventory.md` — the standing map of what the suite covers, updated in place by the
next audit, as [`inventory-agent.md`](agents/inventory-agent.md) says — and `blind-spots.md`
and `recap.md`.

What is left has to stand on its own, because the next run opens on it cold: it takes its
own baseline, re-asks nothing, and merges the rows still unmarked — `SKILL.md` reads a
`plan.md` under `docs/intentional-tests/` holding a row with an empty **Applied** cell as an
apply run waiting to happen.
