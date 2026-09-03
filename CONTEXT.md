# Context

The glossary for this codebase. One entry per domain term: what it means here,
and what it deliberately does not mean. No implementation details — those live
in the code and in `docs/adr/`.

## Account

The single profile a visitor reads and edits: name, first name, email, phone,
language and bio. There is exactly one Account in play at a time — the app has
no notion of a second one, and no notion of an owner distinct from it. "User",
"profile" and "customer" are not used; the Account is the person as far as this
app is concerned.

Its fields are named in French (`nom`, `prenom`, `telephone`, `langue`, `bio`)
because that is the language of the form they came from. That naming stops at
the Account — it is not a convention the rest of the codebase follows.

## Language

The Account's own `langue`: `fr` or `en`. It is a stored _preference_, not the
language the app is written in. The interface is English throughout; the only
thing that honours Language is the formatting of dates in Activity.

## Activity

The read-only history of what has happened to one Account, newest first.
Activity is never edited, filtered or deleted by the visitor — it is a record,
not a workspace. It is the Account's activity, not the visitor's: it is scoped
to the Account and lives alongside it.

## Activity Event

One thing that happened to an Account, recorded at the moment it happened. Each
Activity Event carries when it happened, what kind of thing it was, and a
summary — a short sentence naming what changed, written when the event is
recorded rather than derived later. That sentence is authored once, at the
source, so that reading old Activity never depends on today's field labels.

Named `ActivityEvent` rather than `Event`, which is already the DOM's.

### account.updated

The only kind of Activity Event that exists. It records that the Account was
successfully changed, and names the fields that changed.

There is deliberately no `account.viewed`: reading the Account is not something
that happens _to_ it, and recording reads would bury the changes under noise.
