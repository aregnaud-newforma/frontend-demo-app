# The levels

The four levels every test in this skill lands at.

Each level owns a kind of file and tests it to a set depth:

| Level                 | File                                           | Holds tests for                                         | Tests                                                                                              |
| --------------------- | ---------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| E2E                   | the repo's e2e directory                       | one whole user journey a user normally runs, end to end | the happy paths, each run as a user runs it — every value the user supplies crossing the real seam |
| Integration page      | `*.integration.test.tsx`, beside the page      | a page                                                  | the default render, then happy paths and edge cases                                                |
| Integration component | `*.integration.test.tsx`, beside the component | a component shared by more than one page                | happy paths and edge cases                                                                         |
| Unit                  | `*.unit.test.ts`                               | complex or shared logic                                 | each accepted shape, each rejection reason, each boundary it distinguishes                         |

A behaviour is proved at one level, with two deliberate exceptions — the only places the
same thing is asserted twice:

- **The happy paths** is proved at E2E and Integration page.
- **A shared part** — a component more than one page mounts, or shared logic — is proved at
  its own level (Integration component or Unit) _and_ asserted again inside each page journey
  that already crosses it.

Everything else is proved once: a part only one page mounts is not proved on its own; its
assertions live inside that page's journey.

## What E2E alone proves

Every level below E2E fakes the seam: the network is a handler this repo wrote, and a handler
accepts whatever it is sent. E2E is the only level where the real server answers, so it is the
only level that can prove the request the app builds is a request the API takes.

That sets its **depth**. An E2E journey is filled the way a user fills it — every value the
user supplies crossing the wire, and read back from what the server returned — rather than the
thinnest path that reaches the end. A journey submitting one field proves the navigation and
nothing about the fields beside it, whatever the page journeys assert about them against a
mock.

It does not set its **breadth**. The level still owns one journey and the happy paths only. An
edge case, a validation message, a refused value belong to Integration page, where they cost
milliseconds instead of a device.

## Reading a level off its subject

A file whose name carries its level states it. Where a name does not — the bare `*.test.*`
scaffolding this skill exists to tune — the level is its subject's: a screen is Integration
page, a component more than one screen mounts is Integration component, a helper is Unit,
and the repo's e2e directory is E2E.
