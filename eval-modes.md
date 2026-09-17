# Two questions, one grader

The evals in this repo answer one question today. There is a second question
worth answering with the same tools. This page explains both in plain words,
then shows where each one runs.

## Question A: is my rule well written?

Give the same exercise to an agent twice: once with the rule installed, once
without. Compare the two results. If the rule makes no difference, the rule is
decoration.

This needs two things:

- **A task.** The exercise, with a prompt and a grader that reads the answer.
- **A fixture.** A repo, at a known commit, where the agent does the exercise.

This is what `evals/` does today. The fixture is this repo.

## Question B: do the devs' agents follow the rule in real life?

No exercise. Take the diff of every real pull request and run the same graders
on it. Score it, store it, look at the trend.

This is called **online evaluation**. It needs no task and no fixture. It only
needs the graders and a list of which files count as source.

## One example, both questions

The rule: _never use `useEffect` to derive a value from props or state_.

**Offline (question A).** A task says: "On EditAccountPage, show how many
characters remain under the bio field." The agent works in a clean checkout of
this repo. The grader counts `useEffect(` calls the diff adds. Zero added: PASS.

**Online (question B).** A developer asks Copilot to add a counter on some other
page, in some other repo. They open a pull request. CI runs the same grader on
that diff. One `useEffect(` added: FAIL. The score goes to Langfuse with the tag
`online`.

Same grader. Same score name. Only where the diff comes from changes.

## Where each case runs

| Case                      | Trigger                    | Runs where                  | Command                                                          | What is graded                              |
| ------------------------- | -------------------------- | --------------------------- | ---------------------------------------------------------------- | ------------------------------------------- |
| Local, writing a rule     | by hand                    | plugin repo, your machine   | `evals run --task x --reuse`                                     | the diff of one task, fixture cloned        |
| CI, PR on the plugin repo | a push that touches a rule | plugin repo, Actions        | `evals run --gate react --arm with-skills` plus `previous-skill` | the diffs of the touched gate's tasks       |
| Nightly                   | cron                       | plugin repo, Actions        | `evals run`, every gate, `--repeat 5`, both arms                 | the whole suite, with/without gap           |
| CI, PR on an app repo     | every pull request         | app repo, Actions           | `evals online --base origin/main`                                | the real diff of the PR                     |
| A dev's local session     | a `sessionEnd` hook        | app repo, the dev's machine | `evals online`                                                   | the agent's raw diff, before any human edit |

The first three rows exist in this repo today. The fourth is the online mode.
The fifth is for later.

## Why the runner should move out of this repo

Today the runner (agents, judge, grading, trial, run) and the tasks live in one
folder, in one app. Plugging in a second app means copying seven files.

The fix is to split them:

- **The runner** moves to the plugin repo, next to the skills it measures. It
  becomes a CLI with two commands: `evals run` and `evals online`.
- **A task** names its fixture: a repo URL and a ref. The runner clones it and
  cuts a worktree from that commit, the way `skills.ts` already clones the rules.
- **An app repo** only declares what counts as source (`sourcePaths`), how to
  install, and how to run its checks. That is enough to run `evals online`.

Any repo that installs the plugin can then score its own pull requests without
owning a single task.

## Why judge graders need a second criterion

A `diff` grader is a regex. It works on any diff.

A `judge` grader is a sentence a model reads. Today every sentence names the
task: "the form on EditAccountPage", "the banner under the Save button". The
judge knows what to look for because it knows the exercise.

A real pull request has no exercise. Given the current sentence, the judge
looks for a form that is not in the diff and answers FAIL for the wrong reason.

So each judge grader gets a second sentence, written without a component name:

```
Offline: FAIL if a useEffect resets the AccountFields form when the account prop changes.
Online:  FAIL if a useEffect resets a piece of state because a prop changed.
```

Same rule. Only the task context is gone. The online sentence is also the one a
new fixture can reuse, which is why this and the runner split are one change.

## Where the scores show up in Langfuse

Offline runs are **dataset runs**, so they show under Experiments.

Online scores are not attached to a dataset item, so they show elsewhere:

- **Tracing > Traces.** One trace per scored PR, filtered by the `online` tag.
- **Evaluation > Scores.** Every score, offline and online, under the same
  `<family>_gate` names. This is where the two are compared.
- **Dashboards.** A custom chart on those score names, filtered by tag, is the
  pass rate over time.

## The loop

A pull request that fails a gate online becomes a task offline, with that repo
at that commit as its fixture. That is how the suite grows from your own
examples to real cases.

## Where it stands

The online mode exists in this repo: `evals/online.ts`, run by
`yarn evals:online` and by `.github/workflows/online.yml` on every pull
request. Eleven tasks carry an `online` grader. The judge is off for now, by
`onlineJudge: false` in `evals.config.ts`, so only the diff graders run.

Still to do, in order:

1. Read the judge's verdicts against a few real PRs, then set `onlineJudge` to `true`.
2. Split the runner from the tasks and move it to the plugin repo. `online.ts`
   moves with it and becomes `evals online`.
3. Session hooks, and any merge gate, come after that.
