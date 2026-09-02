---
name: intentional-tests
description: Tune one finished feature's tests — convert the scaffolding it left behind into a few high-signal workflow tests, and close the blind spots they never covered. Run it in a fresh session: an agent holding the implementation in context will vouch for coverage it never checked.
disable-model-invocation: true
---

# Intentional tests

Tests written _while_ a feature is being built are **scaffolding**: the agent needed them
to know the code worked, one narrow assertion at a time. Once the feature is done they are
cost — a mount per assertion, describing the code instead of the user.

**Tuning** converts that scaffolding into a few high-signal workflow tests, and covers the
behaviour green has never touched. Both motions serve one property: **green means the app
works.**

Two inventories drive it — what the tests cover, and what the code does. Every behaviour in
either leaves with a disposition: **merged** into a journey, **dropped** with a reason, or
logged as a **blind spot**.

**This skill writes test files only.** The one exception is a single kind of edit to a source
file: giving a node the query handle the dialect names — a role, an element's semantics, a
translated string on the web, a `testID` in native. Conditions, handlers, state and render
paths stay exactly as they are, and every component touched is named in the recap. Nothing
else in a source file is touched.

## The levels

Four levels, each owning a kind of file and testing it to a set depth, read top to bottom in
**cost order**. The table, the two behaviours proved twice, and how to read a level off a
file's subject are in [`levels.md`](references/levels.md) — the one place this skill defines
them, and what the dispatched agents read too.

## Run it on the right model

The judgment lives in this thread so run the audit on **Opus at high effort**. The dispatched
agents are pinned to Sonnet where they are dispatched.

A skill cannot set the session's model or effort, so this is the developer's `/model` and
`/effort` before the run, not something the run does for itself.

## Say where you are

Open every step by printing its **banner** in the chat — the step's own heading, `**Step 3:
Reconcile**`, on its own line — before doing any of that step's work. Ten steps run across two
files, and the banner is how the developer reads which one is on while a run that dispatches
agents and writes files goes past.

## Step 0: Check the project is set up

Every run opens here, audit and apply alike. Read
`docs/intentional-tests/project-setup.md` before anything else: it records what an earlier
run settled.

Where that file is missing, read [`setup.md`](setup.md) and follow it — every section, in order.

Setup is per repo, not per run.

**Done when `docs/intentional-tests/project-setup.md` exists and what it claims still
holds — the dialect it names, the packages it added, and the runner entries it routed.** A
claim that no longer holds sends that section of [`setup.md`](setup.md) round again.

## Step 1: Choose the feature

A feature here is a **screen**: what the user opens and the whole journey they run inside
it — _browsing their emails_, _managing their account_. That is the altitude the levels
are written at: integration is the default level for a page, integration component the
level for a part more than one screen mounts. The parts a screen mounts — a card, a side
panel, a filter bar — are steps along those journeys, tuned as part of the screen that
holds them. When another screen mounts the same part, it earns its own Integration
component test — its own contract proved once at its own level, rather than written out
afresh in every screen that mounts it.

Every artefact a run writes lives in `docs/intentional-tests/<feature>/`, named for the
source directory being tuned — `docs/intentional-tests/account/` for `src/account`.

### Pick the feature

Where the invocation names a feature, take it and say what it resolved to before going on, so
a mis-resolution costs a sentence, not the whole audit. Otherwise the choice goes to the
developer in two parts, because an app holds far more features than the four options
`AskUserQuestion` carries.

**First, print the whole roster in the chat.** One row per feature the app has, named in the
user's terms — the whole thing the user came to do, not a code path — against the source
directory that backs it, the screens it mounts, and whether it already holds a `plan.md`. The
roster is what makes the four options below a shortlist rather than the only choices.

| Feature             | Dir      | Screens                                             | Plan |
| ------------------- | -------- | --------------------------------------------------- | ---- |
| Working with issues | `issues` | IssuesScreen, CreateIssueScreen, IssueDetailsScreen | ✅   |
| Reading emails      | `emails` | EmailsScreen, EmailDetailsScreen                    |      |

**Plan** carries ✅ where `docs/intentional-tests/<feature>/plan.md` exists, and stays empty
where it does not.

**The roster is complete when every route the app registers appears in a row.** Read them off
the app's own navigation definition — the same one `renderScreen` mounts through — so the
roster is the whole surface rather than what a scan happened to reach. A screen that belongs
to a feature already rostered joins that row; one that belongs to none opens its own.

**Then ask with `AskUserQuestion`** — four options drawn from the roster, the ones already
holding a plan first, then the largest untuned surfaces. Each description carries the
directory, the screens, and whether a plan exists. Word the question so the roster stays
reachable, and let `Other` carry whatever the developer types:

> Which feature should this run tune? Pick one below, or type the one you want to run — any
> feature from the list above.

Scan only as far as the roster takes; the file-by-file reading is step 2, on the one feature
that comes back.

Then look for a `plan.md` under the feature's folder. What it settles is where this run goes
from here — what step 2 sweeps, and what it starts from. Its absence opens one branch below,
its presence three.

### No plan — a fresh audit

The feature has never been tuned. Go to step 2 with an empty inventory and the whole scope.
Steps 2 to 4 build its first ledger from nothing.

### A plan exists — three ways forward

The feature was tuned before, and what the run does next is the developer's call. Where the
invocation already named a use case, take that as **refresh one use case** below and skip the
question. Otherwise check every use case's currency first: for a use case with **Applied** ✅
rows, take the newest date among them and run `git log --since=<that date> --oneline -- <the
feature's own source directory>` — any commit found makes it **stale**, the code has moved
since that row last went green. A use case with no ✅ row yet has nothing to compare against
and is left alone — pending, not stale. A ✍️ row anchors nothing either: its test has never
run, so it dates nothing and goes stale from no commit. Show it as **owed a run**, closed by
the e2e command `project-setup.md` records rather than by a re-audit. Show the developer the
existing plan verbatim, in the format [`plan-format.md`](references/plan-format.md) holds,
read back from `plan.md` as [`applying.md`](applying.md) last left it, with every stale use
case's rows marked 🕒. Then ask
with `AskUserQuestion`, exactly two options, written verbatim, in this order. Word the
question so the third answer below stays reachable:

> How should this run proceed? Pick one below, or type the use case you want to re-audit.

1. **Apply the current plan** — the plan is already approved; skip the audit and go to
   [`applying.md`](applying.md) step 5, where the developer picks which E2E and Integration
   page use cases to merge.
2. **Re-audit the whole feature** — rebuild the ledger against the code and tests as they are
   now. Go to step 2 with the existing `inventory.md` and the whole scope.

**Refresh one use case** is the third answer, and it arrives as free text in `Other`: the
developer writes the use case's name, because no menu option can carry it. Take that name
against the plan's use cases, then go to step 2 with the existing `inventory.md` and the
scope narrowed to what that use case covers.

A re-audit — the whole feature or one use case — changes no test on its own: it updates
`inventory.md` in place, keeps the marked rows, and step 4 gates only what moved. Apply touches no
inventory; it merges rows the plan already holds.

### Fix the scope

**Scope** is what step 2 sweeps, and it follows the branch. A fresh audit or a
whole-feature re-audit sweeps the feature's own source directory **plus the source of every
part it mounts from outside it** — a shared component the screen reaches is in scope on both
sides, so its tests meet its code in step 3 instead of reading as behaviour the code no longer
has, a false drop that deletes the very tests the Integration component level exists to keep.
A one-use-case re-audit narrows to the code and tests that use case covers — its own source
**plus the source of every part it reaches from outside**, for the same reason the whole
feature carries them: a shared component whose tests arrive without its code is a false drop.
Apply sweeps nothing — it works the rows the plan already holds.

**Done when the run holds one feature and one branch:**

- **fresh audit** → step 2, empty inventory, whole scope;
- **re-audit the whole feature** → step 2, existing inventory, whole scope;
- **refresh one use case** → step 2, existing inventory, that use case's scope;
- **apply** → [`applying.md`](applying.md) step 5, the plan's approved rows.

## Step 2: Take inventory

Two censuses: the two lists step 3 reconciles. The tests census is what the suite _claims_; the
code census is what is _true_.

Each census is a **dispatch**: a subagent that reads its own sources, writes its own lines to
the feature's `inventory.md`, and returns the path it wrote and whether its done criterion
holds. The census itself is written in [`inventory-agent.md`](agents/inventory-agent.md),
which is what the dispatched agent reads and nothing else — this thread does the dispatching, and never the reading.

The boundary is the point: an agent holding the implementation writes the first list from
the second. Dispatched, the tests-census agent has read no source file, so the two can only be
arrived at separately.

Dispatch with the `Agent` tool, `subagent_type: "general-purpose"`, `model: "sonnet"`, one
after the other — a line only earns a place in the code census against what the tests census
already listed. Each
prompt carries the census to run, the scope step 1 settled, the path to the feature's
`inventory.md`, and the absolute path to `inventory-agent.md`. The code census reads
`## From the tests` back from that file itself.

**The file is the hand-off.** Both agents write `inventory.md` themselves, so step 3 reads it
back rather than the reports. This thread never sees the reads, so a drop challenged at the
plan gate is answered by re-reading the file its line names.

The audit and the merge can be separate runs days apart, so `inventory.md` outlives the
session that wrote it.

**Done when `inventory.md` holds `## From the tests`, `## From the code` and `## Census`,
every line the scope covers in the shape [`inventory-agent.md`](agents/inventory-agent.md)
names, the code census ranked in loudness order, `## Census` holding a repo path for every
file either census read, and every line outside the scope standing as it was.**

## Step 3: Reconcile

Turn the two censuses into dispositions, in two passes.

**First, drop what earns no test** — with the reason [`drop-reasons.md`](references/drop-reasons.md)
gives. A dropped line is out; it never competes for a level. Doing this pass first keeps a
dropped line from being built into a journey it should not join.

**Then place the rest.** Collapse the survivors into the handful of things a user actually
does — _loads their profile and sees it_, _edits it and returns to the summary_, _is told
what is wrong and fixes it_. Each becomes one test at its level, following
[the levels](references/levels.md), its two proved-twice exceptions included. At Integration
page, what the page arrives with is a row of its own — the **default render**.

**A value the user supplies is proved against the real seam, or it is not proved** —
[the levels](references/levels.md) holds why. When placing, read the request the journey
submits: each value the user supplies that no `[E2E]` line carries joins the E2E row, named in
its **Covers** cell, alongside the page journey that already asserts it. This is not a third
proved-twice exception — the page journey proves what the field does, the E2E journey proves
the API takes it. The gate is where the developer trades each one off against the device time
and the real data it costs, so name them all and let them cut.

Each **blind spot** the code census raised joins the placement too. Most fall into a journey
that already passes through them — one more assertion, mounting nothing new. One that needs a
test of its own says so, and why no journey has room for it.

**Done when every line of both censuses carries a disposition — a journey, a drop reason, or
a blind spot with the journey it lands on.**

## Step 4: Show the plan, and wait

Put the whole ledger in front of the developer before writing a line of it, verbatim, in the
format [`plan-format.md`](references/plan-format.md) holds — cost order puts the rows worth
arguing about first.

A one-use-case re-audit shows that use case's rows and gates those, so the developer argues
what moved rather than re-approving eight settled use cases. The rest of the ledger is read
back from `plan.md` verbatim alongside them, and carries no gate.

Then put the gate with `AskUserQuestion`, exactly two options, written verbatim, in this
order:

1. **Apply it now** — the merge runs against these tables, in this session.
2. **Leave it as an audit** — the plan and the inventory stay on disk, and a later run
   applies them.

An amendment is the third answer and it arrives as free text in `Other`, so the two bare
options are what keep its wording the developer's rather than a menu item you guessed for
them. Fold whatever comes back into the tables, then put the gate again.

**Done when the developer has answered apply or audit against tables holding every
amendment they asked for.** The merge is built from that answer.

The gate also closes the ledger: everything the apply run writes is on these tables
already, and nothing enters later. Its one exception is the query-handle edit above.

Write the balance, the settled tables, their dropped lines and their blind spots to the
feature's `plan.md`. A one-use-case re-audit writes back the rows it gated and leaves every
other use case's rows, `Applied` marks and dates exactly as it found them — the plan is the
whole feature's standing ledger, and a narrowed run is a paragraph of it, not a rewrite. An
audit ends there, with the plan and the inventory on disk: applying it later is another run of
this skill, which finds them and picks up from
[`applying.md`](applying.md). To apply it now, read that file and follow the steps from
there — it opens by asking which one of the plan's use cases this run covers.
