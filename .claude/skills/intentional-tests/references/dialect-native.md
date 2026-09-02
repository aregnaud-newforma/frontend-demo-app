# Dialect: React Native

The local form [`shape.md`](shape.md) takes in a repo that renders to native views. The
shape's rules are there; the mount, the ladder and the APIs they name are here.

## The slots

| Slot          | This dialect                                                                  |
| ------------- | ----------------------------------------------------------------------------- |
| Mount         | `@testing-library/react-native`                                               |
| Actions       | `userEvent` — it ships inside the mount library, no separate package          |
| Test doubles  | `jest.mock`, `jest.fn`, `jest.useFakeTimers`                                  |
| Journey entry | a route name and params: `renderScreen("EditAccount", { id })`                |
| Assertions    | `expect(el).toBeVisible()`, with `findBy*` / `waitFor` for what arrives later |
| E2E           | Detox, against the repo's e2e directory                                       |

Two differences the web dialect does not have, and both bite silently:

- **There is no URL to mount at.** A page journey enters through the app's navigator at a
  route name, so the mount takes a name and params where the web mount takes a path. Nothing
  here resolves a string route.
- **`msw` takes the entry the runner's environment asks for, not the device's.** `setupServer`
  comes from `msw/node` under Jest, and the polyfills it wants belong in the setup file the
  runner already names.

## Mounting a journey

`renderScreen(name, params)` puts the app on a screen through its real navigator, so the
test crosses the params, the guards and the redirects the user crosses, and a journey that
navigates onward stays inside one mount. [`setup.md`](../setup.md) wrote it:

```tsx
export function renderScreen<T extends keyof RootStackParamList>(
  name: T,
  params?: RootStackParamList[T],
) {
  return render(
    <AppProviders>
      <NavigationContainer initialState={{ routes: [{ name, params }] }}>
        <RootNavigator />
      </NavigationContainer>
    </AppProviders>,
  );
}
```

The app's own navigator, not the screen component lifted out of it: the route has to
resolve the way it resolves for a user.

## Mounting a component

The Integration component mount [`setup.md`](../setup.md) wrote:

```tsx
export function renderComponent(ui: React.ReactElement) {
  return render(<AppProviders>{ui}</AppProviders>);
}
```

## The network seam

[`msw.md`](msw.md) holds the server, the lifecycle and the handlers. Two things this dialect
adds around them:

**The entry is `msw/node`, not `msw/native`** — it follows the environment the tests run in,
and that environment is Node, not Hermes. Under `testEnvironment: 'node'` there is no
`XMLHttpRequest`, so an HTTP client picks its http adapter, and only the node entry intercepts
that one. Under any other entry the handlers register, the requests leave unintercepted, and
`onUnhandledRequest: "error"` never fires on a request it never sees.

**Two polyfills the interceptors need** — React Native's runtime is missing `TextEncoder` and
`URL`, and their absence surfaces as a cryptic module error rather than a missing-polyfill
message. `msw`'s own React Native recipe fills them with two packages,
`react-native-url-polyfill` and `fast-text-encoding`, installed as devDependencies with the
package manager the manifest declares, and one file:

```js
// msw.polyfills.js
import "fast-text-encoding";
import "react-native-url-polyfill/auto";
```

The polyfills load in **`setupFiles`**, the server's lifecycle in **`setupFilesAfterEnv`**.
Two different config keys, and the split is what makes it work: `setupFiles` runs before the
test framework exists, which is where a global has to land, while `beforeAll` only exists in
`setupFilesAfterEnv`. A project carrying only `setupFilesAfterEnv` today gains a `setupFiles`
entry here.

```js
// jest.config.js
setupFiles: ['<rootDir>/msw.polyfills.js'],
setupFilesAfterEnv: ['<rootDir>/jestSetup.js'],
```

## Native modules the runtime lacks

Hermes under the runner has no haptics engine, no camera, no image picker, no flag client. Each
one is a `jest.mock` against a double in the directory the repo already keeps its doubles in
(`src/__mocks__/`), exposing the thinnest surface the journey touches.

Write a double the first time a journey needs it: the mount crashes on the missing module, and
the crash names the double to write. One double per crash holds the substitution list to the
modules the suite actually mounts, where a batch written at setup time stands in for modules no
test calls — and every unused one reads as the substitution [`shape.md`](shape.md) hunts.

## What `render<ComponentName>` hands back

### Integration page

```tsx
async function renderEditAccountScreen() {
  const user = userEvent.setup();
  const screen = renderScreen("EditAccount");

  return {
    user,
    loadingIndicator: () => screen.getByTestId("loading-indicator"),
    errorBanner: () => screen.getByRole("alert"),
    savingButton: () => screen.getByRole("button", { name: "Saving..." }),
    /** One field's validation message, e.g. fieldError("Name is required"). */
    fieldError: (message: string) => screen.getByText(message),
    /** Awaits what arrives after the journey moves. */
    findNameInput: () => screen.findByTestId("name-input"),
    findSummary: (name: string) => screen.findByText(name),

    changeName: (value: string) => user.type(screen.getByTestId("name-input"), value),
    saveForm: () => user.press(screen.getByRole("button", { name: "Save" })),
  };
}
```

Queries come back as functions rather than resolved elements: a native `getBy*` throws the
moment it misses, so a query held from before the journey moved is a query for a screen that
has gone.

### Integration component

```tsx
async function renderPhoneField({ value = "", onChange = jest.fn() } = {}) {
  const user = userEvent.setup();
  const screen = renderComponent(<PhoneField label="Phone" value={value} onChange={onChange} />);

  return {
    user,
    onChange,
    phoneInput: () => screen.getByTestId("phone-input"),
    validationMessage: (message: string) => screen.getByText(message),
    typePhone: (digits: string) => user.type(screen.getByTestId("phone-input"), digits),
  };
}
```

## The query ladder

1. **Role** — `getByRole('button', { name: 'Save' })`, on the `accessibilityRole` the
   component sets. The role set is thinner than the DOM's, so a component with no role is a
   component to fix rather than a rung to skip.
2. **Text**, **placeholder**, **display value** — `getByText`, `getByPlaceholderText`,
   `getByDisplayValue`: what the user reads.
3. **`testID`** — `getByTestId`, and in this dialect it is the handle to add. Detox matches
   the same id on the native view tree, so one `testID` serves the integration levels and the
   E2E level alike.

There is no alt-text or title rung: native views carry neither. There is no label rung
either — `accessibilityLabel` resolves to a different native attribute on each platform, so a
label-based query passes on one and fails on the other. Every query a text or role rung cannot
reach goes through `testID`, the one handle both platforms and Detox share.

Landing below rung 2 is a finding about the component, and the one permitted source edit is a
`testID` on the node the journey touches — kebab-case, named for the field:
`testID="name-input"`. Conditions, handlers, state and render paths stay exactly as they are.

A handle the edit **adds** is spelled `testID`, on the host node and on the prop of every
component it forwards through to reach one. React Native reads that exact name off a host
element, and `getByTestId` reads `props.testID` off host elements alone — a composite's own prop
is never queried, however it spells it, so the spelling on the host node is what decides whether
the query lands.

A handle the component **already carries** stands as it is, whatever it spells: the journey
queries it and moves on. Bringing an old spelling to `testID` reaches every call site of that
component — a refactor of its own, and no part of a merge.

Those two meet where a new prop reaches its host through `{...props}`: the spread matches on the
name, so the new prop takes the spelling the child already declares, and a component renamed
alone lands its handle nowhere — a spread drops an unknown name in silence, with no compiler
error to catch it. Rename a pair together, or take the child's spelling and forward it under the
name the host reads: `testID={testId}`.

## Actions

`userEvent.setup()` in the setup function, then `await user.press(…)`, `await user.type(…)`.
It fires the whole sequence a real interaction produces — press in, press out, focus, change.
Await every call. `fireEvent` covers what no user does by hand: `scroll`, a raw
`onChangeText` a library control needs, a layout event.

Where the journey crosses an animation or a debounce, `jest.useFakeTimers()` fakes the clock
and the module stays real.

## Scaffolding to workflow

Three scaffolding tests, one mount each:

```tsx
it("shows a loading state", () => {
  renderEditAccountScreen();
  expect(screen.getByTestId("loading-indicator")).toBeVisible();
});

it("shows the stored name once loaded", async () => {
  seedProfile({ name: "Ada Lovelace" });
  renderEditAccountScreen();
  expect(await screen.findByDisplayValue("Ada Lovelace")).toBeVisible();
});

it("disables save while submitting", async () => {
  renderEditAccountScreen();
  fireEvent.press(screen.getByText("Save"));
  expect(screen.getByText("Saving...")).toBeDisabled();
});
```

become two tests — the default render the file opens on, and the journey that acts on it:

```tsx
// Use case: Renaming a profile — Default render
it("shows the stored account name in an editable form", async () => {
  // Given a stored profile
  const profile = seedProfile();
  const screen = await renderEditAccountScreen();

  // Then it loads and shows what the account holds
  expect(screen.loadingIndicator()).toBeVisible();
  expect(await screen.findNameInput()).toHaveDisplayValue(profile.name);
});

// Use case: Renaming a profile — Happy path
it("renames an account and returns to the summary", async () => {
  // Given a loaded account
  seedProfile();
  const screen = await renderEditAccountScreen();
  await screen.findNameInput();

  // When the user renames and saves
  const edited = profileFactory.build();
  await screen.changeName(edited.name);
  await screen.saveForm();
  expect(screen.savingButton()).toBeDisabled();

  // Then the summary shows the new name
  expect(await screen.findSummary(edited.name)).toBeVisible();
});
```

A query for something that arrives later gets its own `findBy*` entry on the setup's return
— `findNameInput`, `findSummary` — so the journey awaits the screen rather than wrapping
each assertion in `waitFor`.

## E2E

**Detox**, driving a built app on a simulator or emulator. `element(by.id("save-button"))`
and `await element(…).tap()`, with `await waitFor(element(…)).toBeVisible()` for what the
app takes a moment to show.

Two things this level does that the integration levels do not:

- **The same `testID` the integration levels query.** Detox matches on the native view tree,
  where the accessibility mapping is partial and platform-dependent, so the id is the query
  that survives both platforms — and a handle written for one level is already there for the
  other.
- **The app launches for real.** `device.launchApp()`, a real session, a real API. Where the
  repo has a helper for the logged-in state, the journey calls it rather than repeating the
  login.
