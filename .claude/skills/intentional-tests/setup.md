# Setting the project up

What a repo needs before it can hold intentional tests: no conflicting rules, the packages
a journey mounts through, a runner that honours the levels, the seam every journey crosses,
and the shared mount every page journey makes.

This is **once per repo**, not once per run. It ends by writing what it settled to
`docs/intentional-tests/project-setup.md`, which is what lets step 0 of
[`SKILL.md`](SKILL.md) clear every later run on one file read.

Each section asks the developer before it edits their project. Where a section finds
nothing to do, say so and carry on — no question to put.

## Sweep the repo's testing rules

Read where this repo writes its testing rules, by looking rather than guessing: its agent
instructions (`AGENTS.md`, `CLAUDE.md`), the instruction and rule files beside them
(`.*/instructions/`, `.*/rules/`, `.*/skills/`).

Read **the shape** — [`shape.md`](references/shape.md), every rule a merged test follows — and
hold the repo's rules against it. A repo rule **conflicts** when following it would make a
merged test differ from what the shape says.

Report every conflict found — the file and line, the rule as written, and the shape rule it
contradicts. Then ask with `AskUserQuestion`, exactly two options, written verbatim, in
this order:

1. **Remove the conflicting rules and fully adopt the intentional-tests practices
   (Recommended)** — each conflicting rule is cut from the file it lives in, the rest of that
   file untouched, so the repo and the merge say one thing.
2. **Keep the repo rules for the conflicting ones** — the repo rule wins wherever it clashes,
   the merge follows it, and the recap names each one with the merged test that bends to it.

On **Remove the conflicting rules**, the edit is a **deletion**: in each file where a
conflicting rule lives, cut the rule — or the single clause of it that conflicts — and leave
every other line of that file exactly as it stands. This skill stays the one place the
practice is written. Show the developer what came out.

**Done when every testing-rule file the repo holds has been read, and every conflict is
either cut from its file or recorded as kept, with the rule it bends.**

## Fill the package roles

Read the project's manifest and settle every role below.

| Role                                       | Package                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| The mount every test renders through       | `@testing-library/react` — `@testing-library/react-native` on mobile                                                            |
| Every action the journey takes             | `@testing-library/user-event` — on mobile `userEvent` ships inside the mount library, and no separate package is a missing role |
| The fake data                              | `@faker-js/faker`                                                                                                               |
| The journey's fixtures                     | `fishery`                                                                                                                       |
| The API the journey crosses                | `msw`                                                                                                                           |
| The store a round-tripping journey ends on | `@msw/data`, with `zod`                                                                                                         |

Where a role has nothing filling it, ask with `AskUserQuestion` before running anything —
one question, exactly two options, the unfilled roles and the exact packages named in the
question itself. Both options are written verbatim, in this order:

1. **Install the missing packages (Recommended)** — the merge writes the journeys the plan
   approved, factories and handlers included.
2. **Rely on what the repo has** — the merge is held to the packages already there, so every
   row needing a missing one is deferred, named in the run's recap, and left open in the
   inventory for a later run.

The recommendation sits on the first option every run; which one wins is the developer's
call.

On **Install the missing packages**, install as devDependencies with the package manager the
manifest declares, one command, telling the developer what is going in.

**Done when every role above is either filled — by what the project already had, or by an
install this run made — or deferred by the developer's choice.**

## Route the suffixes

`SKILL.md` has the filename state the level; here the runner learns to honour it. Until it
does, `EditAccountPage.integration.test.tsx` is a name with nothing behind it.

Read the project's test configuration — `jest.config.*`, `vitest.config.*`, the `jest` key
in the manifest — and settle two things:

- **Both suffixes resolve.** `*.unit.test.*` and `*.integration.test.*` are matched by the
  runner, and the e2e directory stays outside it.
- **Each level runs alone.** One entry per level — Jest `projects` with a `displayName` and
  a `testMatch` apiece, Vitest projects with an `include` apiece — and a script that names
  it, so cost order is something the developer can act on rather than only read.

Report what the config does today and what the two points above would add. Then ask with
`AskUserQuestion`, exactly two options, written verbatim, in this order:

1. **Route the suffixes to their own runner entries (Recommended)** — the config gains one
   entry per level and a script apiece, so a level can be run, timed and pruned on its own.
2. **Leave the runner flat** — one entry keeps matching every test, the suffix states the
   level for a reader only, and the recap says so.

**Done when the config names one entry per level and a command runs each alone, or the
developer chose the flat runner and that choice is recorded.**

## Wire the seam

`msw` in the manifest is a package. `msw` wired is the **seam** — the one substitution every
integration journey crosses, letting the router, the hooks, the stores and the translations
all run for real. Until the server runs inside the test lifecycle, a journey's handlers do
nothing and the suite reaches the network the developer's laptop is on.

Four things settle it, in the project's test-support directory beside the shared mount, and
[`msw.md`](references/msw.md) holds the code for each:

- **A server**, built once for the whole suite from the dialect's entry, listening with
  `onUnhandledRequest: "error"`.
- **A handlers module per domain**, each exporting its own `handlers`, and an index composing
  them into the shared set the server starts with.
- **The lifecycle — listen, reset, close — in the setup file the runner already names.**
- **A `deferred` helper beside the server**, which a journey holding an answer in flight
  calls.

**Dialect** — resolve it once, here, and every later reader takes it from
`project-setup.md`: `@testing-library/react-native` in the manifest →
[`dialect-native.md`](references/dialect-native.md), else
[`dialect-web.md`](references/dialect-web.md). Read it for the entry and what it needs around
it.

The **store** a round-tripping journey needs — `@msw/data` under `Zod`, in
[`msw.md`](references/msw.md) — goes here too, written when the first such journey asks for
it rather than at setup time.

A **native module** the test environment has no engine for — haptics, camera, image picker, a
flag client — takes a double on the same terms: written the first time a journey mounts
something that calls it, beside the repo's other doubles. Setup leaves that directory as it
found it; the dialect holds the pattern.

**Done when the server starts from the dialect's entry with `onUnhandledRequest: "error"`,
every polyfill the dialect names is installed and loading, the runner's setup file holds
listen, reset and close, `deferred` sits beside the server, and a handlers module exists for
the feature under audit — or `msw` was deferred at the package roles, and the recap says
which rows that leaves waiting.**

## Write the shared mount

`render<ComponentName>` is per test file, but what it mounts _through_ is shared: one module
for the whole app, in the project's test-support directory (`src/test/`, `test-utils/` —
whichever it already has, else create one at the app root). It holds one mount per integration
level, side by side, so a file's import says which level it is written at.

The **dialect** resolved above holds the mount this target takes — a URL on the web, a route
name and params on native — and the code to write it from.

Three things the module holds, whichever dialect writes it:

- **`renderScreen`** — the Integration page mount, built on **the app's own navigation
  definition**, not the page component lifted out of it. The route has to resolve the way it
  resolves for a user.
- **`renderComponent`** — the Integration component mount: one component under `AppProviders`
  and nothing else. A component more than one page mounts has a journey of its own — its props
  in, its callbacks out — and a router around it would only add a screen it never sees.
- **`AppProviders`** — the **composition root** the app builds around either one, holding every
  context the page needs to work: the query client, the theme, i18n, auth, the store. A
  context missing from it lands as a crash or a blank render, so read the page and
  everything it mounts for the hooks they consume, and wrap them all. A provider bound to a
  runtime the test cannot reach is the one substitution beside the network — the shape's mock
  table has the row.

Where the app already exports either one, import it as it stands. Where the providers sit
inline in the entry, write an `AppProviders` for the tests mirroring the same providers in
the same order, and leave the shipped entry exactly as it is — extracting it is the
developer's change, not this skill's. A mirrored stack can drift, so record it as a
follow-up.

**Done when the test-support directory exports all three, and a page and a component each
mount through their own in a line.**

## Record what was settled

Write `docs/intentional-tests/project-setup.md`: **the dialect this repo resolved to**, the
conflicts cut and the ones kept, the packages added and the roles left unfilled, the runner
entries added or the flat runner chosen, where the server and its handlers landed, and where
the shared mount landed. Date it in ISO form.

Record **what the e2e level needs before it can run** beside them. The manifest names its
command; what it does not say is that the command is dead without a build step, a booted
device or a reachable backend. Read the e2e directory's own config and scripts, and write
that chain down: every apply run reads it to decide in seconds whether E2E can run at all,
and one that learns the chain by failing has already spent the minutes. Where the repo has
no e2e directory, record that instead.

That file is what every later run reads instead of resolving any of it again.

**Done when `docs/intentional-tests/project-setup.md` names the dialect, names what the e2e
level needs before it can run or that the repo has no e2e directory, and records an outcome
for every section above — settled, or deferred with the developer's choice.**
