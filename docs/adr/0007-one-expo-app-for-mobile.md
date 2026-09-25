---
status: accepted
date: 2026-09-24
---

# One Expo app for mobile, and a shared package under both

Mobile is `apps/mobile`: a single Expo app on SDK 57 (React Native 0.86, React
19.2), with Expo Router over a native tab bar, Unistyles for styling, and
`jest-expo` for its tests. It is **one build**, where the web is three
(`docs/adr/0003`).

The domain half of the account vertical moved down into `packages/account-core`:
the Zod schema, the French-phone parser, the API client, the `useAccount` query
and the MSW handlers. Both `apps/account` and `apps/mobile` import it. Nothing
else is shared: every screen, style and component is written twice, because the
two are not the same app in two skins.

## Why one build

Module Federation buys independent deployment, and there is none to buy here. A
mobile release is a binary that ships through a store review or an OTA update as
one artefact; a "remote" fetched over the wire at runtime would be a screen the
app cannot render offline, cannot symbolicate a crash in, and - on iOS - is the
kind of thing app review asks about. The cost the web pays for team autonomy
buys nothing on a device.

The verticals still exist as a boundary - they are just folders here rather than
deployments, which is what `docs/adr/0003` says the split is worth only when
teams deploy separately.

## Why a package rather than an app-to-app import

`AGENTS.md` says an app never imports another app: the verticals reach each
other over the wire, and the test tier composes at the root so that no cycle can
form. `apps/mobile` importing `@demo/account` would have been the first edge
between two apps, and it would have dragged React Router and StyleX - neither of
which runs on React Native - along with the schema it actually wanted.

`packages/account-core` is a leaf like `packages/testing` and `packages/tokens`:
it imports nothing of any app's, and what it holds is what has no platform in it.
The one thing that did have a platform in it - `window.location.origin`, which
the web borrows as its API origin - is now `setApiBaseUrl`, called by the host
that has no window.

## What is deliberately duplicated

- **The tokens.** `packages/tokens/tokens.native.ts` restates the palette and
  the scale as plain numbers beside the StyleX `defineVars` that produce CSS
  custom properties. There is no build that turns one into the other, and the
  file says so.
- **The Sentry setup.** `apps/mobile/src/sentry.ts` initialises
  `@sentry/react-native`, which is a different SDK from the shell's
  `@sentry/react` with different integrations. Nothing enforces that the two
  agree - the same warning `AGENTS.md` gives about the two backend services.
- **The QueryClient.** Same options, same reasoning, different SDK underneath,
  for the same reason.

## Consequences

- **No Expo Go.** Unistyles is a Nitro native module and `@sentry/react-native`
  is a native module too, so a device needs a development build:
  `yarn mobile:prebuild && yarn mobile:ios`. Sentry's config PLUGIN is
  deliberately not enabled - it adds a debug-symbol upload phase that fails a
  build with no credentials, which is the same thing `SENTRY_AUTH_TOKEN` gates
  on the web.
- **One React, at the web's version.** `expo install --check` asks for 19.2.3
  and the repository pins 19.2.8; `react-native@0.86.3` peers on `^19.2.3`, so
  one hoisted copy satisfies everything and the check's complaint is cosmetic.
  Two copies would not be: that is a hooks crash in the Metro bundle, and
  `yarn why react` printing a single version is what rules it out.
- **A second test runner.** `jest-expo` renders React Native; Vitest's browser
  mode cannot. The repository's rule is unchanged - the filename picks the tier -
  and `*.native.test.tsx` is the new one.
- **One Babel.** The root pinned `@babel/core` to 8 for the Vite pipeline, and
  the Expo toolchain runs on 7. Both accept 7.29, so the repository is on 7
  everywhere rather than carrying two majors, which is what `babel-jest`
  resolving the wrong one looks like: `loadPartialConfig expects a callback`.
- **The handlers match any origin.** `*/api/account` rather than `/api/account`,
  because a relative path has nothing to resolve against under `msw/node`, which
  is where the mobile tests run.
- **`yarn build` bundles the app too.** `expo export` writes `apps/mobile/dist`,
  which is the only thing in CI that proves the Metro graph resolves across the
  workspace. It does not produce an `.ipa`; that is EAS's job and no task here.
