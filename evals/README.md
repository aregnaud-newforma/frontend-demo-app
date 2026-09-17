# evals

Does an agent working in this repo actually apply the rules in `.claude/skills/`?
`yarn verify` answers that for the 55 rules a linter covers. This directory
answers it for the ones no linter can reach, starting with the effects decision
tree in `.claude/skills/react/references/effects.md`.

Those rules are not this repository's any more — they are published as a Claude
plugin from the repository `evals/skills.pin.json` names. A trial does not
inherit them from whatever the machine has installed; it installs them itself,
at the pinned revision, into the worktree it is about to measure. See
[Where the rules come from](#where-the-rules-come-from).

One suite run is a Langfuse **dataset run**, so the pass rate is a line over time
rather than a number in a terminal that scrolls away.

## Run it

```bash
yarn evals --gate react                 # one gate, one live trial per task
yarn evals --gate javascript            # another gate
yarn evals --task effects-reset-state-with-key   # one task
yarn evals --arm without-skills         # the ablation arm
yarn evals --arm previous-skill --baseline-ref <sha>  # the skill as it was at a commit of the SKILLS repo
yarn evals --repeat 5                   # five passes over each task's prompts instead of one
yarn evals --max-concurrency 3          # three tasks at once (CI does; local output interleaves)
yarn evals --reuse                      # re-score stored trials, no trial spawned
yarn evals --run-name before-skill-edit # name the run yourself
yarn evals --agent claude               # the agent under test (`copilot` by default)
yarn evals --model claude-sonnet-5      # the model under test (the agent's own, by default)
yarn evals --effort low                 # its effort level (the agent's own, by default)
yarn evals --max-turns 120              # the per-trial turn budget, for an agent that takes one
yarn evals --judge-agent claude          # who grades judged tasks (`copilot` by default)
yarn evals --judge-model gpt-5.4         # the model it grades with (the judge's own, by default)
yarn evals --judge-effort high           # its effort level (the judge's own, by default)
yarn evals --list-gates                 # the gates that have a task, as JSON
yarn evals --list-agents                # the agents and the default one, as JSON
```

Requires Node 22 (`.nvmrc`) and `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`,
`LANGFUSE_BASE_URL` in `.env`.

**A live trial costs money**, though less than it did. Each one spawns `claude -p`
in a fresh worktree and lets it work until it is done. The first measured trial
cost $2.36 over 51 turns and seven minutes on Claude Fable 5.1, nearly all of it
`yarn verify` and `yarn test`, which `AGENTS.md` asks of every agent here. With
`checks: "skip"` (see below) the same task runs in **8 turns for about $0.40**.
Use `--reuse` whenever you are changing a grader rather than measuring an agent.

A run costs that **times the task's prompts, times `--repeat`**, which is one by
default. See below for when one is not enough.

The model under test moved from Fable 5.1 to **Opus 5**, which is half the price
per token ($5/$25 per MTok against $10/$50) and the harder test, since a skill
helps a weaker model more. The line steps there: trials measured before the move
are a different experiment, and stored trials are keyed by model so `--reuse`
cannot serve one as the other.

## Where the rules come from

The rules used to be `.claude/skills/<gate>` of this repository, and a trial got
them for free: the worktree was a checkout of `HEAD`, so the rules came with the
code. They are a Claude plugin published from another repository now, and a
worktree cut from this one holds none of them.

Nothing about that is visible from inside a trial, which is what made it
dangerous rather than merely broken. The plugin is installed against a project
path and enabled by that project's settings, so an agent running in `/tmp/eval-…`
silently has no rules — and a `with-skills` arm measuring an agent with no rules
scores like the arm that removed them. The gate would read _"this skill does
nothing"_, which is the plausible, false number this whole suite exists to
refuse.

So the harness stops inheriting the rules and installs them. `evals/skills.pin.json`
names the repository, the ref and the directory inside it; `evals/skills.ts`
clones it once into gitignored `evals/.skills/`, resolves the ref to a commit,
and fills each worktree's `.claude/skills/` from that commit with `git archive`.
The commit travels in the run metadata, so a score says which text produced it.

Three choices in there are load-bearing:

- **Not the clone `claude plugin` leaves in `~/.claude/plugins`.** It is shallow
  — one commit — so it can serve neither a pin other than its tip nor any
  baseline; the CLI fetches and moves it, so it can change under a ninety-minute
  run; and it is where a rule is authored, so it may hold uncommitted edits.
- **`git archive`, not a copy.** It reads a revision without touching the clone's
  working tree, so nothing uncommitted can reach a measurement. Use the tree-ish
  form `<rev>:<path>` — the two-argument form emits entries under the full path,
  and extracting that would bury every rule three directories deep where no agent
  looks and no error is raised.
- **The gates and no more, though the plugin ships eleven skills.** An extra one
  is not neutral: `react-native` describes itself in terms of re-renders and
  performance, which is what three of the `react` gate's tasks are about, and an
  agent that reaches for it instead scores the gate at zero while behaving
  sensibly.

## The two arms

`--arm without-skills` installs nothing into the worktree, empties the three
skill directories anyway, and removes the Skills section of `AGENTS.md`, before
the agent starts. It answers the question a
green run cannot: whether the skill caused the pass, or the model already knew the
rule and the skill is decoration.

The `AGENTS.md` edit is part of the arm on purpose. A pointer to files that no
longer exist is itself a signal, and an agent that notices a missing skill is not
the same as one that was never told skills exist — that would be two variables.
Only `.claude/skills` is removed, not `.claude/`, so an empty `settings.json`
today cannot silently become a second variable tomorrow. The directories are
emptied even though this arm installed nothing into them, because what an agent
might find there is not this repository's to know.

One confound stays, and it is now the sharper one: a skill enabled at **user**
scope — a personal directory, or the plugin itself enabled outside a project —
is outside the worktree and outside the strip. It is identical in both arms, so
it cannot explain a difference, but the arm is _without the rules this suite
installed_, not without any rule.

Stored trials are keyed by arm, and a `with-skills` key carries a hash of the
rules it was given, so `--reuse` can serve neither one arm's outcome as the
other's nor a trial run against rules that have since changed. A
`without-skills` key carries no such hash on purpose: that arm installs nothing,
so the revision is not one of its inputs, and keying it would discard the one
arm worth caching every time a rule moved.

**The arm is only as good as the strip.** A rule stated somewhere the strip does
not reach stays in both arms, and the comparison measures nothing — this happened
once, with a rule `AGENTS.md` restated verbatim from the `react` skill. Before
trusting a new task's ablation, grep the repository for the rule it gates. The
rule that `AGENTS.md` restated is gone, and `AGENTS.md` now says why nothing
outside `.claude/skills/` may restate a rule: the strip cannot chase copies.

**Trials run from `HEAD`.** A worktree is created from the last commit, so an
uncommitted edit to a skill or to `AGENTS.md` is invisible to a trial. Commit the
rule change, then measure it.

## The third arm

`--arm previous-skill --baseline-ref <ref>` starts from `HEAD` like the others,
installs every gate at the pinned revision, then puts `<gate>` back the way it
was at `<ref>` — **a ref of the skills repository, not of this one**. Everything
else — the code, the other skills, `AGENTS.md`, the harness, the CLI, the model,
the hour — is the same in both runs, so the delta between `with-skills` and this
arm is the effect of the edit to the skill, and nothing else.

That is a different question from the ablation's. `without-skills` says what the
skill is worth; `previous-skill` says whether the last change to it helped. A
`with-skills` run read against last night's is the second question asked
badly: the two runs differ by a CLI version, a day, and whatever the model
felt like, and the score cannot say which moved it.

Two guards. `--baseline-ref` is refused on any other arm, so a run's metadata
never names a baseline the trial did not restore. And a ref whose rules are
identical to the pinned revision's is refused outright: there is nothing to
compare, and paying for both sides of it is the one thing this arm exists to
avoid. The check is on the directory's tree hash, which is also what the stored
trial is keyed by — `main` moves, its rules often do not, and two refs holding
the same text are one experiment.

Every run records `skillTree` — a hash over the text of every gate installed —
beside `skillsRef`, `skillsCommit` and `skillsRepo`, and a `previous-skill` run
records `baselineRef`, `baselineCommit` and `baselineSkillTree` too. That is how the two runs of a comparison are
paired in Langfuse without reading the clock.

Where it belongs: locally, `--baseline-ref <the commit the pin held before>`
after bumping `evals/skills.pin.json`, one task, `--repeat 1`. It is **not** in
the CI matrix any more, and the reason is worth stating: this repository's diff
can show that the pin moved but not which rule moved with it, and only the
skills repository's own history can say. Until its pipeline drives this workflow,
`previous-skill` is a manual arm. Not in the nightly either, which would compare
the pin against itself and be refused.

## The files

| File                 | Owns                                                                   |
| -------------------- | ---------------------------------------------------------------------- |
| `../evals.config.ts` | what this repository asks to be measured, and what counts as an answer |
| `tasks.ts`           | the prompts, what each one expects, and the grader                     |
| `config.ts`          | the config's shape, and the one place it is loaded and checked         |
| `grading.ts`         | what a task is, and how a diff-counted answer is scored                |
| `agents.ts`          | the agent under test: its CLI, its result shape, where its rules live  |
| `trial.ts`           | isolation: worktree, the resulting diff, the stored outcome            |
| `judge.ts`           | the LLM grader, for rules a diff cannot separate                       |
| `run.ts`             | Langfuse: dataset, run, scores, and the command line                   |

The split is down the middle of `evals.config.ts`: everything above it is this
repository's, everything below knows nothing about it. `tasks.ts` is on the
repository's side and sits in this directory only because 300 lines of prompt
prose do not belong in a config file.

The config holds seven keys — `tasks`, `sourcePaths` and the optional
`defaultAgent`, `defaultJudge`, `agents`, `judges` and `maxConcurrency` — and the
shortness is the point. Arms and repetition are flags with a default in `run.ts`,
and a key beside one of those would be a second place a run's conditions get
decided. There is no `--config` either: a suite that can be
pointed at two of them is a suite whose scores were produced under conditions
nobody can read off the run.

The other four earn their place twice, in two pairs that read as one sentence
each — `defaultAgent` and `agents`, then `defaultJudge` and `judges`. Each is a
chain rather than a second place — flag, then this file, then the adapter's own
pin — and each lands in the run metadata. That is the test a key has to pass to live here. A
condition nobody could read off the run would fail it however convenient the key
looked.

`sourcePaths` has no default on purpose. A default that missed this repository's
sources would leave every diff empty, and an empty diff scores 0 on every task —
a plausible, false number, which is the one thing this suite exists not to
produce.

## Another agent

`--agent` names who is under test, and `defaultAgent` in `evals.config.ts` names
who that is when the flag is absent — the flag wins, the config is next, and the
harness's own default is last. The key is optional, and a repository measuring
the agent the harness already defaults to should leave it out rather than copy
the value.

`defaultJudge` is the same chain for `--judge-agent`, and never derived from
`defaultAgent`: the judge is the instrument and the agent is the subject, so a
judge that followed whoever was under test would move the ruler and the thing
measured at once. The harness defaults to `copilot` for both, and this
repository leaves both keys out. The vendors still differ: the subject runs on
`gpt-5.4` and the judge reads on `claude-sonnet-5`, through the same CLI. Put
`claude` under test and that split closes — add `--judge-model gpt-5.4` to
reopen it.

CI follows that key rather than restating it: the Copilot CLI is installed in
every job because the judge needs it, and each agent's own CLI only in the jobs
that put it under test. Move `defaultJudge` and that condition has to move with
it, or every judged task comes back `judge_error`.

`agents` and `judges` are the same chain again, for the model and the effort,
keyed by the CLI they belong to:

```ts
agents: { copilot: { model: "gpt-5.3-codex", effort: "low" } },
judges: { claude: { model: "claude-haiku-4.5" } },
```

Keyed, because a model id is a string one CLI knows and another has never heard
of — a flat `model` here would be handed to whoever ran. Each entry is checked
against the CLI it names as the config loads, so `gpt-5.4` under `claude`, an
effort a CLI does not take, or a name that is nobody all fail before a worktree
is cut:

```
evals.config.ts: `agents.claude.effort` takes one of low, medium, high, xhigh, max, not "bogus".
```

The pins in `agents.ts` and `judge.ts` are what this suite measured its history
with. Overriding one steps the line — nothing scored after is comparable to what
came before — which is a thing to do deliberately rather than by inheriting a
config from elsewhere.

`maxConcurrency` is the odd one out, and it is not about the experiment at all:
it is how fast this machine may go. Not keyed by CLI like the two above, because
it is the account's quota and the reader's patience that it answers to, not the
agent's. The harness runs one task at a time; set it here when this repository's
runs are normally unattended.

`agents.ts` is the seam, and deliberately the only file that knows a CLI exists:
the worktree, the diff, the graders and the Langfuse reporting never ask who
wrote the change. An `Agent` declares what its
CLI takes, and `run.ts` refuses anything it does not — **nothing is recorded that
was not applied**, which is the same rule the model and effort pins already obey.

`claude`, `codex` and `copilot` are wired. Claude and Copilot have both been run
and probed; only Codex has never been, having been written against the documented
flags — check `codex exec --help` before trusting a score from it, and expect the
model id to need pinning to whatever your account actually serves. Read the CLI
rather than the docs page: GitHub's published page lists barely a third of what
`copilot --help` does, and three of this adapter's flags are absent from it.

Four things do not port, and the shape of the code says so:

- **Where the rules live.** Claude pulls a skill in on demand; an agent reading
  only `AGENTS.md` has whatever it is pointed at in context from the first token.
  The two arms are therefore not the same treatment across agents. **The
  with/without delta is what travels; the absolute pass rate is not**, and two
  agents on one chart are two experiments. `stripRules` is nonetheless shared:
  this repository keeps its rules in one place, so the arm that removes them
  removes the same files whoever was reading them.
- **Effort and turns.** `--effort` is a flag on Claude, `--reasoning-effort` one
  on Copilot, and a config override on Codex. The levels differ too: Codex takes
  three of the five this suite names, Copilot all five plus two with no
  counterpart. Neither Codex nor Copilot has a turn cap. Each agent declares its
  `efforts` and its `defaultMaxTurns`, and a level or a budget outside them is a
  command-line error rather than a flag quietly dropped. Trials on both are
  therefore bounded only by the timeout — which stops a loop after the money is
  spent, not before.
- **Cost.** Claude reports dollars; `codex exec --json` reports tokens and no
  price; `copilot --output-format json` reports premium requests, which is a
  count of calls and not a price. An agent that reports no cost publishes no
  `trial_cost_usd` score at all, because a zero reads as a free run. Copilot does
  report a wall-clock duration, so that one field is real there.
- **Saying it failed.** Claude answers with a `subtype`, Codex with a
  `turn.failed` event, Copilot with an `exitCode` on the last line of its JSONL —
  all three can tell a trial the harness could not obtain from an agent that
  answered badly, which is the difference between `unavailable` and a zero.

**Before a Codex run means anything**, the rules have to reach it. The Skills
section of `AGENTS.md` names Claude's Skill tool, which Codex has not, and it
scans `.agents/skills` where this repository keeps none — so its `with-skills`
arm hands over a pointer that cannot be followed, scores near-identically to
`without-skills`, and reads as a skill with no effect where there is one.

Copilot is not in that position, which `copilot skill --help` settles: it
discovers `.github/skills`, `.agents/skills` **and** `.claude/skills`. A probe
confirms the loading rather than the documentation — an agent run in a scratch
directory holding one `.claude/skills/greet/SKILL.md` came back with
`skillsInvoked: ["greet"]` and no `--add-dir` needed. Both arms are a real
comparison there, and which rules were read is recorded per trial.

The judge is one CLI whichever agent is under test — `copilot` by default, and
`--judge-agent` is the only way to move it for a single run. It is the
instrument, not the subject: grading Codex's diff with Codex would move the
ruler and the thing measured at once, so hold it fixed across a series of runs
you mean to compare. In CI that means every job installs the Copilot CLI,
including the Claude and Codex ones.

Two are implemented. `copilot` is the default, reading on `claude-sonnet-5`: the
other vendor from the `gpt-5.4` it grades by default, through the CLI CI already
has. The pin is the point — Copilot's own default happens to be Sonnet too, but
a judge that followed the CLI would change what "pass" means the day the CLI
changes its mind. `claude` is the instrument this suite's history was measured
with, and the only one that takes its rules as a system prompt.

A `claude` subject under the default judge is Claude reading Claude; pass
`--judge-model gpt-5.4` for that run. Copilot has no system-prompt flag, so the
grading rules travel in the same prompt as the diff and the summary the agent under test wrote — rules the
summary sits beside rather than under. `--no-custom-instructions` at least leaves
them the only instructions in play.

CI runs Copilot alone unless asked. An `evals:<agent>` label on a pull request
selects who runs — `evals:claude`, `evals:codex`, `evals:copilot`, or any
combination — and no label at all means the default alone. A label naming an
agent that does not exist fails the run rather than quietly scoring the default.
The manual button takes one agent name or `both` instead.

It is opt-in because the agent axis multiplies against the gates and the arms:
an `AGENTS.md` edit already runs every gate in both arms, and a second agent
doubles that. And `evals:codex` on its own scores Codex against nothing from the
same commit — legitimate when the port is what you are debugging, useless when
the rule is.

## How a task is written

Prompts are **indirect**. They state a product need and never name a rule, a
hook or a skill, because a prompt that says "do not use an effect" measures
whether the model can follow an instruction, not whether it retrieved the rule.

A task carries a **list** of prompts, one trial each, and today every list holds
one. The list exists for the question repetition cannot ask: `--repeat` replays
the same words, so it measures the model's dice and nothing about the phrasing.
A second entry — the same need said casually, or at an edge of the rule — is
what tells a rule that holds from a rule that holds only against the sentence
it was written for. Every entry is scored into the same per-task mean, so
adding one changes what the score averages, not what it is named.

Each task declares its **grader**, and there are two.

`kind: "diff"` counts calls the agent added. The task supplies the call as a
pattern — `added: String.raw`\buse(Layout)?Effect\s*\(`` — and the harness
anchors it to _added_ lines, so a task that touches a component with a
pre-existing legitimate effect cannot fail for code the agent never wrote, and
no task has to remember to write that anchor. Prefer it whenever a rule has an
API signature: it is cheap, deterministic and hard to argue with.

The pattern is on the task and not in a fixed list of families, because a rule
family is this repository's business: the list this replaced had four entries
and two of them were dead, left over from tasks that had since become judged.

`kind: "judge"` exists for the rules where that is not enough. See below.

Each task also states a **checks policy**. `AGENTS.md` tells any agent in this
repo to finish with `yarn verify && yarn test`, and that is where most of a
trial's turns go. Nothing in either can catch a misplaced effect — the absence of
such a check is the reason this suite exists — so every effects task sets
`checks: "skip"` and the harness appends one line telling the agent to make the
change and stop. The line names no command: what a project's checks are called
is in its `AGENTS.md`, which the agent has already read.

Two things make that safe. The line is a harness instruction appended to every
arm of a comparison, so it cannot explain a difference between two runs. And the
grader reads only the diff, so an agent that never type-checks its work is judged
on exactly what it wrote.

It is a per-task setting rather than a harness-wide one because it stops being
safe the moment a task's rule is one a check could catch. A task gating the
`testing` skill measures whether the agent writes and runs a test at all: that
one sets `checks: "run"` and pays for it.

The set is balanced on purpose: two tasks where an effect is the wrong answer,
one (`effects-dom`) where synchronising with the DOM makes it the right one. A
suite that only ever expects zero would pass a model that had simply forgotten
effects exist.

## How many trials a task gets

`--repeat` is the number of passes over each task's prompts, and it is **1** by
default. At `--repeat 2` a task with one prompt gets two trials; one with three
gets six. A pass covers every prompt before the next pass starts, so a run cut
short still holds whole passes.

One is a coin flipped once. The score a single trial produces is 1 or 0, and
nothing in it says how repeatable that is: a gate that reads 5/5 one week and
4/5 the next has moved by 0.2, which is roughly one standard deviation of a
five-task run whose true pass probability is 0.8. Neither number is wrong, and
neither answers the question — the movement is indistinguishable from the dice.

Repeating turns the per-task score into a mean over its trials, so a task that
passes once in two reads as **0.5** rather than as whichever trial happened to be
graded. The run's pass rate is then the mean of those means, which Langfuse
computes itself as the `Ø rule_gate` column of the runs list: every task weighs
the same whatever happened inside its repetitions, so a task cannot count twice
for having been sampled twice.

So the default answers the cheap question — did this edit break something
obvious — and nothing more. It is 1 because that is the run people actually type,
and a default that doubled the bill of every one of them would be paid to answer
a question most were not asking.

Ask for the samples when the run is asking the other question. Two is the
smallest count that can disagree with itself: it proves nothing on its own, but
it makes a flaky task visible as a 0.5 instead of letting it alternate silently
between two clean runs. Five or ten is for the tasks whose two arms sit within a
point of each other, because that is precisely what repetition answers and
precisely where the money is worth spending.

The cost is linear, and `repeat` travels in the run metadata: a pass rate read
without knowing how many samples it averages says nothing about how much of its
movement is noise.

CI on a pull request passes **1** explicitly rather than inheriting it, so the
tier says what it measures even if this default moves again. Repetition belongs
where the question is how much of a gap is noise, which is the scheduled run and
the manual one: `workflow_dispatch` takes `repeat`, so a run that wants a
measurement asks for the samples.

## Gates

A gate is one skill, named exactly as its directory under `.claude/skills/`, and
one Langfuse dataset. `yarn evals --list-gates` prints the ones that carry a
task, which is every gate there is: a gate is declared by a task naming it, and
a skill nobody wrote a task for is not one.

`--gate` is required whenever more than one exists, and has no default. A
default would run a single skill and report its pass rate as the suite's, which
reads as five skills passing when four were never asked. A named `--task`
settles the gate on its own, and a repository with one gate has nothing to
choose.

The name is the join CI needs. A pull request touching
`.claude/skills/react/**` runs the react gate and nothing else, because the gate
and the path are the same word — a rule-family name like `effects` matched no
path, so every rule edit used to run every gate and pay for it. The workflow's
`changes` job reads `--list-gates`, intersects it with the skill directories in
the diff, and builds its matrix from the result. A change to `AGENTS.md`,
`CLAUDE.md` or the harness runs all of them: those move any gate.

The harness splits in two there. `evals.config.ts`, `tasks.ts`, `trial.ts` and
`judge.ts` decide
what a trial is — the prompt, the pinned model, the strip, the criterion — so a
change to one runs every gate in **both** arms: the ablation stopped being a
constant, and the baseline has to be re-measured. `run.ts` decides what is
recorded rather than what the agent is given, so it runs every gate in
`with-skills` alone. `README.md` changes nothing and triggers nothing.

A gate is deliberately coarser than a rule, so a `react` run averages effects and
re-render alike. Nothing diagnostic is lost, because the score is per task and the
Compare view reads it task by task, with the grader's `family` in front of each
comment and in the item's metadata. The score itself is `rule_gate` for every
task: it used to be named after the family, and five gates already made eleven
mostly empty columns of the runs list.

`intentional-tests/` is not a gate. It is not one of the five skills `AGENTS.md`
declares, and no task gates it.

## What lands in Langfuse

| Langfuse noun          | Here                                                                              |
| ---------------------- | --------------------------------------------------------------------------------- |
| Dataset `react`        | one gate, one skill                                                               |
| Dataset item           | one task, keyed by its id                                                         |
| Dataset run            | one execution of that gate                                                        |
| Trace                  | one trial                                                                         |
| Score `rule_gate`      | the grader's verdict, meaned over the task's trials; its Ø is the run's pass rate |
| Score `trial_error`    | no answer: rate limit, timeout, out of turns on a judged task                     |
| Score `judge_error`    | how many trials the judge could not answer                                        |
| Score `skill_invoked`  | whether the gate's skill was loaded, meaned over its trials                       |
| Score `trial_cost_usd` | what that task cost, trials summed                                                |

Each run carries the commit SHA and branch as metadata, so a run can be traced
back to the state of `.claude/skills/` that produced it.

It also carries the conditions the score was produced under. The model is pinned
(`--model`, default `gpt-5.4` under Copilot, `claude-opus-5` under Claude)
because the CLI's default follows the plan and the account, and an unpinned
model makes two runs different experiments under one name. So is its effort
(`--effort`, default `high` for every agent): unpinned, each CLI reads it from
the settings of whichever machine runs it, and a laptop and a CI runner can
disagree. `--effort low` is a second experiment
worth running by hand — a rule that survives a model thinking less is a rule
that carries the model, rather than one the model was going to find anyway. What
cannot be pinned is recorded: `runner` (`local` or `ci`),
`cliVersion`, and the host of `ANTHROPIC_BASE_URL`. The CLI decides when a skill
enters the agent's context, so a CLI upgrade can move the `with-skills` arm alone
— which without the field reads as a skill regression.

Compare runs of the same kind. A CI baseline is not comparable to a local one.

Items skipped by `--task` receive **no score at all** rather than a zero. A score
of zero would be indistinguishable from a failure and would drag the pass rate
down for a task that never ran.

The same holds for a trial the harness could not run. `claude -p` killed by a
rate limit, by the fifteen-minute timeout, or by a CLI that would not start
writes `trial_error` and no `rule_gate` score — a zero there reads, on the chart,
exactly like a skill that regressed. Only one non-zero exit is an answer, and
only half of one: an agent that ran out of `--max-turns` left a diff, and a diff
grader reads it. It never wrote its closing summary, because the CLI kills it
before that message, so a judged task writes `trial_error` for that trial rather
than let the judge fail the silence — a criterion about _why_ is answered from
the summary, and an empty one would score the budget, not the agent. The trial
line in the log says `out of turns` when this happens; a task that hits it on
every run needs a larger `--max-turns`, not a better skill. In CI, where the
token is shared and trials run three abreast, read a burst of `trial_error` as
an exhausted five-hour window, not as a regression.

The exit code draws that line for CI. Any verdict the run could not reach — a
trial that would not run, a judge that would not answer, a judged task cut off
before its summary — makes `run.ts` delete its dataset run from Langfuse and
exit non-zero: the job is red because it failed to measure, not because of what
it measured, and the chart holds only runs that measured. The reasons are in the
report `run.ts` prints, which CI copies into the job summary. The traces stay,
with what the failed trials cost. A gate that scores 0 exits zero and stays on
the chart; that is an answer.

In CI that deletion loses the verdicts the run did reach, since the runner's
trial cache goes with the runner. Locally the cache stays, and `--reuse` will
publish those verdicts again once the cause is fixed.

## The judge

Some rules have no diff signature. `modern-set-operations` is the one that forced
this: the agent read the rule's `requires: ES2025`, read this repo's `lib` floor
of ES2023, concluded the rule did not apply and wrote an array `filter`. An agent
with no skills writes the same `filter` out of ignorance. **Identical diff,
opposite reasoning, one score** — and the evidence sat unread in the agent's
closing summary.

So a judged task carries a `criterion` in prose, and `judge.ts` hands a model the
criterion, the prompt, the diff and the summary, and takes back
`{"passed", "reason"}`. The criterion lives in `tasks.ts` rather than in a
Langfuse form for two reasons: a CI gate has to read its own score before the job
ends, and a criterion is the definition of the score — it must be reviewable in a
pull request and changeable in the same commit as the rule it measures.

It is falsifiable, and that was checked rather than assumed. Given the real
summary the judge passes `modern-set-operations` and cites the ES2025-versus-lib
sentence; given the same diff with a bland summary it fails it, for "no evidence
the choice was a deliberate check rather than habit".

Three things keep it honest:

- **The judge is resolved separately from the subject.** It defaults to
  `claude-sonnet-5` at `high`, and the judge, its model and its effort all travel
  in the run metadata beside `agent`, `model` and `effort`. Two models move in
  this system; a judge that followed the CLI default would change what "pass"
  means without leaving a trace. Effort stays high because the judge costs a cent
  and a verdict that flips on a borderline diff costs a gate score.
- **A judge that fails does not score zero.** It writes `judge_error` instead and
  no `rule_gate` score at all. A zero from an unreachable model is indistinguishable
  from a skill that regressed, and unattributable numbers are what this suite
  exists to stop producing.
- **A judge adapter is held to a higher bar than an agent one.** A subject
  adapter that is wrong fails its own trial visibly; a judge adapter that is
  wrong moves every score in the dataset quietly, including those of runs that
  did not change judge. Both adapters here were probed against the installed CLI
  before being trusted, which is why Codex is still absent: `codex exec` has no
  system-prompt flag either, and no verified isolation to pair with one.
- **The judge has no repository.** It runs in a scratch directory with tools, MCP
  and slash commands disabled — otherwise it could confirm a criterion the agent
  never satisfied. That isolation is also what makes it affordable: a plain
  `claude -p` question loads 148,068 tokens of context and costs **$0.59**; the
  same question with those flags loads about 3,000 and costs **$0.012**, roughly
  one percent of the trial it is grading. Copilot measures the same way: 18,209
  prompt tokens with its 18 tools loaded, 2,774 with `--available-tools none`.
  That flag is a whitelist, and passing it with no value at all is silently
  ignored rather than rejected — which is how a judge ends up holding every tool
  it was meant to have none of.

Prefer a diff grader. Reach for the judge when, and only when, the same code
could be right or wrong depending on why it was written.

## Stored trials

A completed trial is written to
`evals/.runs/<task-id>.<agent>.<arm>.<model>.<effort>.v<prompt>.r<repetition>.json`
(git-ignored). It holds the diff, the agent's summary, and the cost. `--reuse`
grades that stored outcome instead of spawning a new one, which makes fixing a
grader — or adding one — free.

The agent and the model are in the key, not only the arm. Without them, moving
the pinned model would let `--reuse` serve a Fable trial into a run whose
metadata says Opus: a
plausible number that is false, which is the worst thing an eval can produce.
The effort is there for the same reason. Trials stored before it entered the
key carry no effort in their name and are not served: which level they ran at
is not known, and a guess in a filename is the same false number.

The prompt index and the repetition are there for a smaller version of the same
reason: the trials of one task are the samples the score averages, and a key
without them would let the second overwrite the first. `--reuse` only counts a
task as stored when **every** trial the run asks for is on disk, every prompt
and every repetition — a task missing some still spends the trials it lacks,
rather than averaging three samples under metadata that claims five.

## Adding a task

Append to `TASKS` in `tasks.ts`, which `evals.config.ts` hands to the harness. The `id` is the rule file the prompt tempts an
agent to break, taken from `.claude/skills/<gate>/references/` without its
extension, so an item in Langfuse names the rule it gates. `effects-dom-sync-is-valid`
is the exception and reads as one: it guards the case where an effect is right,
which is a section of `effects.md` rather than a rule of its own.

That id is also the Langfuse dataset item id, and it must stay stable, because
it is what ties this month's score to last month's. Editing a prompt under an
existing id, or adding a second one to its list, is deliberate: the score history
continues. Renaming the id starts a
new history — so if a rule file is renamed, leave the id alone and let it drift
rather than trade the history for a tidier name.

Retiring a task is deleting it from `TASKS`: the next run of its gate archives
the item it left behind, so it drops out of future runs while its score history
survives. Archiving rather than deleting is the point — a deleted item takes the
runs it already scored with it.
