# evals

Does an agent working in this repo actually apply the rules in `.claude/skills/`?
`yarn verify` answers that for the 55 rules a linter covers. This directory
answers it for the ones no linter can reach, starting with the effects decision
tree in `.claude/skills/react/references/effects.md`.

One suite run is a Langfuse **dataset run**, so the pass rate is a line over time
rather than a number in a terminal that scrolls away.

## Run it

```bash
yarn evals                              # the react gate, one live trial per task
yarn evals --gate javascript            # another gate
yarn evals --task effects-reset-state-with-key   # one task
yarn evals --arm without-skills         # the ablation arm
yarn evals --repeat 5                   # five trials per task instead of two
yarn evals --max-concurrency 3          # three tasks at once (CI does; local output interleaves)
yarn evals --reuse                      # re-score stored trials, no trial spawned
yarn evals --run-name before-skill-edit # name the run yourself
yarn evals --agent codex                # the agent under test (`claude` by default)
yarn evals --model claude-opus-5        # the model under test (the agent's own, by default)
yarn evals --effort low                 # its effort level (the agent's own, by default)
yarn evals --max-turns 120              # the per-trial turn budget, for an agent that takes one
yarn evals --judge-model claude-sonnet-5 # the model that grades judged tasks
yarn evals --judge-effort high          # its effort level (pinned by default)
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

A run costs that **times `--repeat`**, which is two by default. See below for why
one is not enough.

The model under test moved from Fable 5.1 to **Opus 5**, which is half the price
per token ($5/$25 per MTok against $10/$50) and the harder test, since a skill
helps a weaker model more. The line steps there: trials measured before the move
are a different experiment, and stored trials are keyed by model so `--reuse`
cannot serve one as the other.

## The two arms

`--arm without-skills` removes `.claude/skills` from the worktree, and the Skills
section of `AGENTS.md` with it, before the agent starts. It answers the question a
green run cannot: whether the skill caused the pass, or the model already knew the
rule and the skill is decoration.

The `AGENTS.md` edit is part of the arm on purpose. A pointer to files that no
longer exist is itself a signal, and an agent that notices a missing skill is not
the same as one that was never told skills exist — that would be two variables.
Only `.claude/skills` is removed, not `.claude/`, so an empty `settings.json`
today cannot silently become a second variable tomorrow.

One confound stays: user-level skills in `~/.claude/skills` are outside the
worktree. They are identical in both arms, so they cannot explain a difference,
but the arm is _without this repo's skills_, not without any skill.

Stored trials are keyed by arm, so `--reuse` cannot grade one arm's outcome as
the other's.

**The arm is only as good as the strip.** A rule stated somewhere the strip does
not reach stays in both arms, and the comparison measures nothing — this happened
once, with a rule `AGENTS.md` restated verbatim from the `react` skill. Before
trusting a new task's ablation, grep the repository for the rule it gates. The
rule that `AGENTS.md` restated is gone, and `AGENTS.md` now says why nothing
outside `.claude/skills/` may restate a rule: the strip cannot chase copies.

**Trials run from `HEAD`.** A worktree is created from the last commit, so an
uncommitted edit to a skill or to `AGENTS.md` is invisible to a trial. Commit the
rule change, then measure it.

## The five files

| File        | Owns                                                                  |
| ----------- | --------------------------------------------------------------------- |
| `tasks.ts`  | the prompts, what each one expects, and the grader                    |
| `agents.ts` | the agent under test: its CLI, its result shape, where its rules live |
| `trial.ts`  | isolation: worktree, the resulting diff, the stored outcome           |
| `judge.ts`  | the LLM grader, for rules a diff cannot separate                      |
| `run.ts`    | Langfuse: dataset, run, scores, and the command line                  |

## Another agent

`--agent` names who is under test. `agents.ts` is the seam, and deliberately the
only file that knows a CLI exists: the worktree, the diff, the graders and the
Langfuse reporting never ask who wrote the change. An `Agent` declares what its
CLI takes, and `run.ts` refuses anything it does not — **nothing is recorded that
was not applied**, which is the same rule the model and effort pins already obey.

`claude`, `codex` and `copilot` are wired. Only the Claude adapter has ever
been run: the other two were written against the documented flags, so check
`codex exec --help` or `copilot help` before trusting a score, and expect the
model id to need pinning to whatever your account actually serves.

Four things do not port, and the shape of the code says so:

- **Where the rules live.** Claude pulls a skill in on demand; an agent reading
  only `AGENTS.md` has whatever it is pointed at in context from the first token.
  The two arms are therefore not the same treatment across agents. **The
  with/without delta is what travels; the absolute pass rate is not**, and two
  agents on one chart are two experiments. `stripRules` is nonetheless shared:
  this repository keeps its rules in one place, so the arm that removes them
  removes the same files whoever was reading them.
- **Effort and turns.** `--effort` is a flag on Claude, a config override on
  Codex, and on Copilot a settings-file key that cannot be set for one run
  without also supplying that CLI's model and MCP config — so Copilot declares
  no efforts at all. Neither Codex nor Copilot has a turn cap. Each agent
  declares its `efforts` and its `defaultMaxTurns`, and a level or a budget
  outside them is a command-line error rather than a flag quietly dropped.
  Trials on both are therefore bounded only by the timeout — which stops a loop
  after the money is spent, not before.
- **Cost.** Claude reports dollars; `codex exec --json` reports tokens and no
  price; `copilot -p -s` reports nothing, the flag that leaves the final message
  alone on stdout being the same one that strips the stats. An agent that reports
  no cost publishes no `trial_cost_usd` score at all, because a zero reads as a
  free run.
- **Saying it failed.** Claude answers with a `subtype`, Codex with a
  `turn.failed` event: both can tell a trial the harness could not obtain from an
  agent that answered badly, which is the difference between `unavailable` and a
  zero. Copilot offers only an exit code, so a run that fails partway and still
  exits zero is scored as an answer. That is the known hole in that adapter, and
  it needs a structured output mode to close.

**Before a Codex or Copilot run means anything**, the rules have to reach them.
The Skills section of `AGENTS.md` names Claude's Skill tool, which Codex has not;
Copilot does not read `.claude/skills` at all, looking instead in `AGENTS.md`,
`.github/copilot-instructions.md`, `.github/instructions/**` and its own skills
location. Either way the `with-skills` arm hands over a pointer that cannot be
followed, scores near-identically to `without-skills`, and reads as a skill with
no effect where there is one.

The judge stays Claude whichever agent is under test. It is the instrument, not
the subject: grading Codex's diff with Codex would move the ruler and the thing
measured at once. In CI that means every job installs the Claude CLI, including
the Codex ones.

CI runs Claude alone unless asked. An `evals:<agent>` label on a pull request
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

Each task declares its **grader**, and there are two.

`kind: "diff"` counts calls the agent added — `useEffect` and `useLayoutEffect` on
_added_ lines only, so a task that touches a component with a pre-existing
legitimate effect cannot fail for code the agent never wrote. Prefer it whenever
a rule has an API signature: it is cheap, deterministic and hard to argue with.

`kind: "judge"` exists for the rules where that is not enough. See below.

Each task also states a **checks policy**. `AGENTS.md` tells any agent in this
repo to finish with `yarn verify && yarn test`, and that is where most of a
trial's turns go. Nothing in either can catch a misplaced effect — the absence of
such a check is the reason this suite exists — so every effects task sets
`checks: "skip"` and the harness appends one line telling the agent to make the
change and stop.

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

`--repeat` is the number of times each task is run, and it is **2** by default.

One is a coin flipped once. The score a single trial produces is 1 or 0, and
nothing in it says how repeatable that is: a gate that reads 5/5 one week and
4/5 the next has moved by 0.2, which is roughly one standard deviation of a
five-task run whose true pass probability is 0.8. Neither number is wrong, and
neither answers the question — the movement is indistinguishable from the dice.

Repeating turns the per-task score into a mean over its trials, so a task that
passes once in two reads as **0.5** rather than as whichever trial happened to be
graded. `pass_rate` is then the mean of those means: every task weighs the same
whatever happened inside its repetitions, so a task cannot count twice for having
been sampled twice.

Two is the smallest count that can disagree with itself, which is what makes it
the default rather than an ambition. It halves nothing and proves nothing on its
own; what it does is make a flaky task visible as a 0.5 instead of letting it
alternate silently between two clean runs. Raise it — 5, 10 — for the tasks whose
two arms sit within a point of each other, because that is precisely the question
repetition answers and precisely where the money is worth spending. Drop it to 1
when the point of the run is to exercise the harness rather than to measure
anything.

The cost is linear, and `repeat` travels in the run metadata: a pass rate read
without knowing how many samples it averages says nothing about how much of its
movement is noise.

CI on a pull request overrides it to **1**. That tier asks whether a rule change
broke something obvious, and one trial answers that for a third of the money —
a push touching `AGENTS.md` runs every gate in both arms, and the second sample
doubles it. Repetition belongs where the question is how much of a gap is noise,
which is the scheduled run and the manual one: `workflow_dispatch` takes
`repeat`, so a run that wants a measurement asks for the samples.

## Gates

A gate is one skill, named exactly as its directory under `.claude/skills/`, and
one Langfuse dataset. `yarn evals --list-gates` prints the ones that carry a
task; the rest of `GATES` in `tasks.ts` is vocabulary waiting for its first task.

The name is the join CI needs. A pull request touching
`.claude/skills/react/**` runs the react gate and nothing else, because the gate
and the path are the same word — a rule-family name like `effects` matched no
path, so every rule edit used to run every gate and pay for it. The workflow's
`changes` job reads `--list-gates`, intersects it with the skill directories in
the diff, and builds its matrix from the result. A change to `AGENTS.md`,
`CLAUDE.md` or the harness runs all of them: those move any gate.

The harness splits in two there. `tasks.ts`, `trial.ts` and `judge.ts` decide
what a trial is — the prompt, the pinned model, the strip, the criterion — so a
change to one runs every gate in **both** arms: the ablation stopped being a
constant, and the baseline has to be re-measured. `run.ts` decides what is
recorded rather than what the agent is given, so it runs every gate in
`with-skills` alone. `README.md` changes nothing and triggers nothing.

A gate is deliberately coarser than a rule, so a `react` run averages effects and
re-render alike. Nothing diagnostic is lost, because the per-task score is named
after the task's `api` — `effects_gate`, `memoization_gate` — not after the gate,
and each stays its own line in Langfuse.

`intentional-tests/` is not a gate. It is not one of the five skills `AGENTS.md`
declares, and no task gates it.

## What lands in Langfuse

| Langfuse noun          | Here                                                          |
| ---------------------- | ------------------------------------------------------------- |
| Dataset `react`        | one gate, one skill                                           |
| Dataset item           | one task, keyed by its id                                     |
| Dataset run            | one execution of that gate                                    |
| Trace                  | one trial                                                     |
| Score `effects_gate`   | the grader's verdict, meaned over the task's trials           |
| Score `trial_error`    | no answer: rate limit, timeout, out of turns on a judged task |
| Score `judge_error`    | how many trials the judge could not answer                    |
| Score `trial_cost_usd` | what that task cost, trials summed                            |
| Run score `pass_rate`  | the number to watch over time                                 |

Each run carries the commit SHA and branch as metadata, so a run can be traced
back to the state of `.claude/skills/` that produced it.

It also carries the conditions the score was produced under. The model is pinned
(`--model`, default `claude-opus-5`) because the CLI's default follows the plan
and the account, and an unpinned model makes two runs different experiments under
one name. So is its effort (`--effort`, default `high`, Opus 5's own): unpinned,
`claude -p` reads `effortLevel` from the settings of whichever machine runs it,
and a laptop and a CI runner can disagree. `--effort low` is a second experiment
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
writes `trial_error` and no `*_gate` score — a zero there reads, on the chart,
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

- **The judge is pinned separately from the subject.** `JUDGE_MODEL` is
  `claude-sonnet-5`, `JUDGE_EFFORT` is `high`, and both travel in the run
  metadata beside `model` and `effort`. Two models move in this system; a judge
  that followed the CLI default would change what "pass" means without leaving
  a trace. Effort stays high because the judge costs a cent and a verdict that
  flips on a borderline diff costs a gate score.
- **A judge that fails does not score zero.** It writes `judge_error` instead and
  no `*_gate` score at all. A zero from an unreachable model is indistinguishable
  from a skill that regressed, and unattributable numbers are what this suite
  exists to stop producing.
- **The judge has no repository.** It runs in a scratch directory with tools, MCP
  and slash commands disabled — otherwise it could confirm a criterion the agent
  never satisfied. That isolation is also what makes it affordable: a plain
  `claude -p` question loads 148,068 tokens of context and costs **$0.59**; the
  same question with those flags loads about 3,000 and costs **$0.012**, roughly
  one percent of the trial it is grading.

Prefer a diff grader. Reach for the judge when, and only when, the same code
could be right or wrong depending on why it was written.

## Stored trials

A completed trial is written to
`evals/.runs/<task-id>.<agent>.<arm>.<model>.<effort>.r<repetition>.json`
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

The repetition index is there for a smaller version of the same reason: the
repeated trials of one task are the samples the score averages, and a key without
it would let the second overwrite the first. `--reuse` only counts a task as
stored when **every** repetition the run asks for is on disk — a task missing
some still spends the trials it lacks, rather than averaging three samples under
metadata that claims five.

## Adding a task

Append to `TASKS` in `tasks.ts`. The `id` is the rule file the prompt tempts an
agent to break, taken from `.claude/skills/<gate>/references/` without its
extension, so an item in Langfuse names the rule it gates. `effects-dom-sync-is-valid`
is the exception and reads as one: it guards the case where an effect is right,
which is a section of `effects.md` rather than a rule of its own.

That id is also the Langfuse dataset item id, and it must stay stable, because
it is what ties this month's score to last month's. Editing a prompt under an
existing id is deliberate: the score history continues. Renaming the id starts a
new history — so if a rule file is renamed, leave the id alone and let it drift
rather than trade the history for a tidier name.

Retiring a task is deleting it from `TASKS`: the next run of its gate archives
the item it left behind, so it drops out of future runs while its score history
survives. Archiving rather than deleting is the point — a deleted item takes the
runs it already scored with it.
