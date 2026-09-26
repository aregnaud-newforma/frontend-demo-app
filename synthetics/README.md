# Synthetic tests

Datadog Synthetic Monitoring runs two tests against the local stack: one on
the account API, one on the account page. They live in Datadog and are edited
in its UI, not from this repository, so this file is the only record of what
they should contain. Change a test in
Datadog, change it here too.

They run in two ways:

- **On a schedule**, from a private location on this machine: a worker in
  `../compose.yaml` that polls Datadog for its tests.
- **On demand**, with `yarn synthetics:run`, through datadog-ci's Continuous
  Testing tunnel. The command fails when a test fails.

Both target the preview builds, so `yarn preview` must be running.

## One-time setup

1. **Create the private location.** In Datadog, go to Synthetic Monitoring >
   Settings > Private Locations > Add Private Location. Name it
   `frontend-demo-app local`. Save the configuration file it gives you as
   `synthetics/.private-location.json`. It holds secret keys, and git ignores
   it.
2. **Start the worker** with `yarn synthetics:start`. The location shows as
   running in Datadog once the worker polls. It also reads `DATADOG_API_KEY`
   from `.env`: without it, browser runs still pass but their screenshots
   fail to upload with a 403.
3. **Add an application key** to `.env` as `DATADOG_APP_KEY`, beside
   `DATADOG_API_KEY` (`.env.example` says where both come from). Only
   `yarn synthetics:run` needs it.
4. **Create the two tests below.** Give both the tag
   `repo:frontend-demo-app`: it is how `yarn synthetics:run` finds them.

Both use `http://localhost:4173`, from the worker as well as through the
tunnel: `../compose.yaml` explains how the worker reaches this machine's
localhost.

Neither sets a session, so both read the demo account the API seeds
(`server/Accounts/Session.cs`). That account is editable in the app, so the
tests check its shape and that it is on screen, never its values.

The location and both tests already exist in the org on `datadoghq.eu`:
`pl:frontend-demo-app-local-6dceb8a58b4419ff9d47114a19f8309e`, `s6m-hy5-xcf`
(test 1) and `suc-kmr-u82` (test 2). The steps are for recreating them.

## Test 1: Account API answers with an account

New Test > API Test > HTTP.

- **Request:** `GET http://localhost:4173/api/account`. Through the shell's
  proxy, as the browser reaches it, so a broken proxy fails the test too.
- **Assertions:**
  - status code is `200`
  - response time is less than `1000` ms. Loose on purpose: the point is to
    catch a hang on a laptop, not to benchmark it.
  - body validates this JSON Schema, the shape the front end reads
    (`packages/account-core/src/api.ts`):

    ```json
    {
      "type": "object",
      "required": ["id", "nom", "prenom", "email", "telephone", "langue", "bio"],
      "properties": {
        "id": { "type": "string" },
        "nom": { "type": "string", "minLength": 1 },
        "prenom": { "type": "string", "minLength": 1 },
        "email": { "type": "string", "minLength": 1 },
        "telephone": { "type": ["string", "null"] },
        "langue": { "enum": ["fr", "en"] },
        "bio": { "type": "string" }
      }
    }
    ```

- **Locations:** only `frontend-demo-app local`. A managed location cannot
  reach localhost.
- **Frequency:** every 5 minutes.
- **Retry:** 1 time after 300 ms, so a blip does not flip the monitor.
- **CI/CD execution:** blocking.

## Test 2: Account page renders the account through the shell

New Test > Browser Test.

- **Starting URL:** `http://localhost:4173/account`
- **Browser and device:** Chrome, laptop large.
- **Locations, retry, CI/CD execution:** as test 1.
- **Frequency:** every 15 minutes. A browser run costs more than an API run,
  and test 1 already watches the backend every 5.
- **Steps**, recorded with Datadog's Chrome extension or added by hand:
  1. Assert page contains `Your account`. The heading comes from the account
     remote, so this proves the shell fetched it (`docs/adr/0003`).
  2. Assert element present, with the CSS selector
     `[data-testid="account-summary"]` as its user-specified locator. The
     summary renders only after the API answers, so this proves the page got
     its data.

## Notifications

Leave the monitor message without an `@` handle. The target is a laptop, down
whenever `yarn preview` is, and an alert that pages someone for that is noise.
A deployed target would name its team's channel.
