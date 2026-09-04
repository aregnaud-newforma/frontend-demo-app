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
yarn evals --reuse                      # re-score stored trials, spends nothing
yarn evals --run-name before-skill-edit # name the run yourself
yarn evals --max-turns 40               # raise the per-trial turn budget
yarn evals --list-gates                 # the gates that have a task, as JSON
```

Requires Node 22 (`.nvmrc`) and `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`,
`LANGFUSE_BASE_URL` in `.env`.

**A live trial costs money**, though less than it did. Each one spawns `claude -p`
in a fresh worktree and lets it work until it is done. The first measured trial
cost $2.36 over 51 turns and seven minutes on Claude Fable 5.1, nearly all of it
`yarn verify` and `yarn test`, which `AGENTS.md` asks of every agent here. With
`checks: "skip"` (see below) the same task runs in **8 turns for about $0.40**.
Use `--reuse` whenever you are changing a grader rather than measuring an agent.

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
long-term answer is that a rule has one source; the strip cannot chase copies.

**Trials run from `HEAD`.** A worktree is created from the last commit, so an
uncommitted edit to a skill or to `AGENTS.md` is invisible to a trial. Commit the
rule change, then measure it.

## The three files

| File       | Owns                                                 |
| ---------- | ---------------------------------------------------- |
| `tasks.ts` | the prompts, what each one expects, and the grader   |
| `trial.ts` | isolation: worktree, `claude -p`, the resulting diff |
| `run.ts`   | Langfuse: dataset, run, scores, and the command line |

## How a task is written

Prompts are **indirect**. They state a product need and never name a rule, a
hook or a skill, because a prompt that says "do not use an effect" measures
whether the model can follow an instruction, not whether it retrieved the rule.

The grader reads the **outcome**, meaning the diff, not the transcript. It counts
`useEffect` and `useLayoutEffect` on _added_ lines only, so a task that touches a
component with a pre-existing legitimate effect cannot fail for code the agent
never wrote.

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

A gate is deliberately coarser than a rule, so a `react` run averages effects and
re-render alike. Nothing diagnostic is lost, because the per-task score is named
after the task's `api` — `effects_gate`, `memoization_gate` — not after the gate,
and each stays its own line in Langfuse.

`intentional-tests/` is not a gate. It is not one of the five skills `AGENTS.md`
declares, and no task gates it.

## What lands in Langfuse

| Langfuse noun          | Here                          |
| ---------------------- | ----------------------------- |
| Dataset `react`        | one gate, one skill           |
| Dataset item           | one task, keyed by its id     |
| Dataset run            | one execution of that gate    |
| Trace                  | one trial                     |
| Score `effects_gate`   | 1 or 0, the grader's verdict  |
| Score `trial_cost_usd` | what that trial cost          |
| Run score `pass_rate`  | the number to watch over time |

Each run carries the commit SHA and branch as metadata, so a run can be traced
back to the state of `.claude/skills/` that produced it.

It also carries the conditions the score was produced under. The model is pinned
(`--model`, default `claude-fable-5-1`) because the CLI's default follows the plan
and the account, and an unpinned model makes two runs different experiments under
one name. What cannot be pinned is recorded: `runner` (`local` or `ci`),
`cliVersion`, and the host of `ANTHROPIC_BASE_URL`. The CLI decides when a skill
enters the agent's context, so a CLI upgrade can move the `with-skills` arm alone
— which without the field reads as a skill regression.

Compare runs of the same kind. A CI baseline is not comparable to a local one.

Items skipped by `--task` receive **no score at all** rather than a zero. A score
of zero would be indistinguishable from a failure and would drag the pass rate
down for a task that never ran.

## Stored trials

A completed trial is written to `evals/.runs/<task-id>.json` (git-ignored). It
holds the diff, the agent's summary, and the cost. `--reuse` grades that stored
outcome instead of spawning a new one, which makes fixing a grader free.

## Adding a task

Append to `TASKS` in `tasks.ts`. The `id` is the rule file the prompt tempts an
agent to break, taken from `.claude/skills/react/references/` without its
extension, so an item in Langfuse names the rule it gates. `effects-dom-sync-is-valid`
is the exception and reads as one: it guards the case where an effect is right,
which is a section of `effects.md` rather than a rule of its own.

That id is also the Langfuse dataset item id, and it must stay stable, because
it is what ties this month's score to last month's. Editing a prompt under an
existing id is deliberate: the score history continues. Renaming the id starts a
new history — so if a rule file is renamed, leave the id alone and let it drift
rather than trade the history for a tidier name.

Retire a task by archiving its item in Langfuse, not by deleting it. Archived
items drop out of future runs while their history survives; an item merely
removed from `TASKS` stays live in the dataset and reappears unscored.
