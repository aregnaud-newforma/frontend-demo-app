# Dialect: web

The local form [`shape.md`](shape.md) takes in a repo that renders to the DOM. The shape's
rules are there; the mount, the ladder and the APIs they name are here.

## The slots

| Slot          | This dialect                                                                  |
| ------------- | ----------------------------------------------------------------------------- |
| Mount         | `@testing-library/react`, under Vitest with `environment: "jsdom"`            |
| Actions       | `userEvent` from `@testing-library/user-event`                                |
| Test doubles  | `vi.mock`, `vi.fn`, `vi.useFakeTimers`                                        |
| Journey entry | a URL: `renderScreen("/account/edit")`                                        |
| Assertions    | `expect(el).toBeVisible()`, with `findBy*` / `waitFor` for what arrives later |
| E2E           | Playwright, `e2e/*.spec.ts`                                                   |

## Mounting a journey

`renderScreen(path)` puts the app at a URL, so the test crosses the routing, the params and
the redirects the user crosses. [`setup.md`](../setup.md) wrote it:

```tsx
export function renderScreen(path: string) {
  return render(
    <AppProviders>
      <RouterProvider
        router={createRouter({
          routeTree,
          history: createMemoryHistory({ initialEntries: [path] }),
        })}
      />
    </AppProviders>,
  );
}
```

## Mounting a component

The Integration component mount [`setup.md`](../setup.md) wrote:

```tsx
export function renderComponent(ui: React.ReactElement) {
  return render(<AppProviders>{ui}</AppProviders>);
}
```

## The network seam

[`msw.md`](msw.md) holds it. One thing this dialect settles: the entry is **`msw/node`** — it
follows the environment the tests run in, and under `environment: "jsdom"` that environment
is Node. The lifecycle goes in the setup file `setupFiles` names.

## What `render<ComponentName>` hands back

### Integration page

```tsx
function renderEditAccountPage() {
  const user = userEvent.setup();
  renderScreen("/account/edit");

  return {
    user,
    loadingIndicator: () => screen.getByRole("status"),
    errorBanner: () => screen.getByRole("alert"),
    savingButton: () => screen.getByRole("button", { name: "Saving..." }),
    /** One field's validation message, e.g. fieldError("Name is required"). */
    fieldError: (message: string) => screen.getByText(message),
    /** Awaits what arrives after the journey moves. */
    findNameInput: () => screen.findByLabelText("Name"),
    findSummary: (name: string) => screen.findByText(name),

    changeName: (value: string) => user.type(screen.getByLabelText("Name"), value),
    saveForm: () => user.click(screen.getByRole("button", { name: "Save" })),
  };
}
```

Queries come back as functions rather than resolved elements: `getBy*` throws the moment it
misses, so a query resolved at setup time is a query for a screen the journey has not reached
— the loading indicator, the banner and the saving button are each absent at mount.

### Integration component

```tsx
function renderPhoneField({ value = "", onChange = vi.fn() } = {}) {
  const user = userEvent.setup();
  renderComponent(<PhoneField label="Phone" value={value} onChange={onChange} />);

  return {
    user,
    onChange,
    phoneInput: () => screen.getByLabelText("Phone"),
    validationMessage: (message: string) => screen.getByText(message),
    typePhone: (digits: string) => user.type(screen.getByLabelText("Phone"), digits),
  };
}
```

## The query ladder

1. **Role** — `getByRole('button', { name: 'Save' })`. Everything a user sees or operates
   has one, and its name comes from the text or label already on screen.
2. **Label** — `getByLabelText`, for a form field and for anything carrying an `aria-label`.
3. **Placeholder**, **text**, **display value** — `getByPlaceholderText`, `getByText`,
   `getByDisplayValue`: what the user reads.
4. **Alt text**, **title** — `getByAltText`, `getByTitle`.
5. **`data-testid`** — `getByTestId`, the last rung, and the only one that means nothing to
   a user.

Landing below rung 4 is a finding about the component. The first move is its accessibility
markup: roles, ARIA attributes, element semantics, a translated label.

## Actions

`userEvent.setup()` in the setup function, then `await user.click(…)`, `await user.type(…)`.
It fires the whole sequence a real interaction produces — pointer down, focus, key events,
change. Await every call. `fireEvent` covers what no user does by hand: `scroll`, `resize`, a
raw `input` a library control needs.

Where the journey crosses an animation or a debounce, `vi.useFakeTimers()` fakes the clock
and the module stays real.

## Scaffolding to workflow

Three scaffolding tests, one mount each:

```tsx
it("shows a loading state", () => {
  renderProfilePage();
  expect(screen.getByRole("status")).toBeVisible();
});

it("shows the stored name once loaded", async () => {
  seedProfile({ name: "Ada Lovelace" });
  renderProfilePage();
  expect(await screen.findByLabelText("Name")).toHaveValue("Ada Lovelace");
});

it("disables save while submitting", async () => {
  const user = userEvent.setup();
  renderProfilePage();
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
});
```

become two tests — the default render the file opens on, and the journey that acts on it:

```tsx
// Use case: Renaming a profile — Default render
it("shows the stored profile name in an editable form", async () => {
  // Given a stored profile
  const profile = seedProfile();
  const view = renderProfilePage();

  // Then it loads and shows what the profile holds
  expect(view.loadingIndicator()).toBeVisible();
  expect(await view.findNameInput()).toHaveValue(profile.name);
});

// Use case: Renaming a profile — Happy path
it("renames a profile and returns to the summary", async () => {
  // Given a loaded profile
  seedProfile();
  const view = renderProfilePage();
  await view.findNameInput();

  // When the user renames and saves
  const edited = profileFactory.build();
  await view.changeName(edited.name);
  await view.saveForm();
  expect(view.savingButton()).toBeDisabled();

  // Then the summary shows the new name
  expect(await view.findSummary(edited.name)).toBeVisible();
});
```

A query for something that arrives later gets its own `findBy*` entry on the setup's return
— `findNameInput`, `findSummary` — so the journey awaits the screen rather than wrapping
each assertion in `waitFor`.

## E2E

**Playwright**, driving a real browser against a running app. `page.getByRole(…)` and
`await expect(locator).toBeVisible()` — the same query ladder as above, since Playwright
resolves roles from the same accessibility tree the DOM exposes.

Two things this level does that the integration levels do not:

- **The app runs for real.** A real server, a real API, real storage. Where the repo has a
  fixture or a stored auth state for the logged-in session, the journey uses it rather than
  repeating the login.
- **Page objects hold the queries.** Playwright resolves them from the same tree, so a
  journey's verbs read as they do one level down.
