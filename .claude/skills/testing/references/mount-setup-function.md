---
title: One `render<ComponentName>` Returning Queries and Verbs
impact: HIGH
impactDescription: the journey reads as what the user sees and does
tags: mount, setup, queries, AHA
---

## One `render<ComponentName>` Returning Queries and Verbs

Raw queries in a test body say how a node was found, not what the user is looking at, and every test repeats them. One setup function per file creates the user, mounts through `renderRoute` or `renderComponent`, and hands back **queries as functions** — a `getBy*` throws the moment it runs, so a node absent at mount must not be queried until the journey reaches it — and **actions as verbs** wrapping `user.type`, `user.click`, `user.selectOptions`.

**Incorrect (queries inline, repeated across tests):**

```tsx
it("saves", async () => {
  await seedAccount();
  const user = userEvent.setup();
  renderRoute("/account/edit");
  await user.type(await screen.findByLabelText("Name"), "Ada");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByRole("heading", { name: "Your account" })).toBeVisible();
});
```

**Correct (the setup owns the queries; the test reads as prose):**

```tsx
function renderEditAccountPage() {
  const user = userEvent.setup();
  renderRoute("/account/edit");

  return {
    // findBy*: the form arrives once the account has been fetched
    nameInput: () => screen.findByLabelText("Name"),
    // getBy*: on screen once the journey is there
    saveButton: () => screen.getByRole("button", { name: "Save" }),
    savingButton: () => screen.findByRole("button", { name: "Saving..." }), // arrives when the save starts
    accountHeading: () => screen.findByRole("heading", { name: "Your account" }),
    fieldError: (message: string) => screen.findByText(message), // arrives after validation

    changeName: async (value: string) => {
      const input = await screen.findByLabelText("Name");
      await user.clear(input);
      await user.type(input, value);
    },
    saveForm: () => user.click(screen.getByRole("button", { name: "Save" })),
  };
}

it("saves", async () => {
  const account = await seedAccount();
  const form = renderEditAccountPage();
  await form.changeName(account.nom);
  await form.saveForm();
  expect(await form.accountHeading()).toBeVisible();
});
```

Each entry picks its flavour once — `findBy*` where the node arrives later, `getBy*` where it is already on screen, `queryBy*` where a test asserts it absent — and the test body never chooses again. A query whose text varies takes an argument — `fieldError(message)`, `summaryValue(term)` — one entry covering every message that slot can carry.

**At Integration component, the same function takes two more things.** A component mounted alone is proved on its contract — props in, callbacks out — so the setup takes **every prop as an argument with a default**, and **returns the callback spy**:

```tsx
function renderPhoneField({ value = "", disabled = false, onChange = vi.fn() } = {}) {
  const user = userEvent.setup();
  renderComponent(<PhoneField label="Phone" value={value} disabled={disabled} onChange={onChange} />);

  return {
    onChange,
    phoneInput: () => screen.getByLabelText("Phone"),
    typePhone: (digits: string) => user.type(screen.getByLabelText("Phone"), digits),
  };
}

it("emits the number in E.164 once it is complete", async () => {
  const field = renderPhoneField(); // names only the prop its case turns on
  await field.typePhone("0612345678");
  expect(field.onChange).toHaveBeenLastCalledWith("+33612345678");
});
```

A page setup has neither: its props come from the route, and what it hands out is on screen.
