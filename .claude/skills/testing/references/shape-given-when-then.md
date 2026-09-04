---
title: Mark the Legs, and Assert Intermediate States Where They Happen
impact: LOW
impactDescription: a loading or in-flight state costs one assertion, not one mount
tags: shape, given-when-then, intermediate state
---

## Mark the Legs, and Assert Intermediate States Where They Happen

`// Given`, `// When`, `// Then` mark where one leg of the journey ends and the next begins, and they may repeat — a held answer gives a second `Given` mid-test. A loading state, a disabled button, a flagged field are asserted **inside** the journey that causes them, on the line where the user would see them, rather than in a test of their own that mounts everything again to prove one transition.

**Incorrect (a mount per transition, no legs):**

```tsx
it("shows loading", async () => {
  await seedAccount();
  const form = renderEditAccountPage();
  expect(await form.loadingIndicator()).toBeVisible();
});

it("disables save while saving", async () => {
  await seedAccount();
  const form = renderEditAccountPage();
  await form.saveForm();
  expect(await form.savingButton()).toBeDisabled();
});
```

**Correct (the transitions asserted as legs of the journey they belong to):**

```tsx
it("edits the name, saves, and lands on the summary", async () => {
  // Given a loaded form
  const account = await seedAccount();
  const form = renderEditAccountPage();
  expect(await form.nameInput()).toHaveValue(account.nom);

  // When the user renames and saves, with the save held open
  const { promise: saveArrives, resolve: releaseSave } = deferred();
  server.use(
    http.put(ACCOUNT_URL, async () => {
      await saveArrives;
      return HttpResponse.json(accounts.findFirst());
    }),
  );
  const edited = accountValuesFactory.build();
  await form.changeName(edited.nom);
  await form.saveForm();

  // Then Save is disabled while the save is in flight
  expect(await form.savingButton()).toBeDisabled();

  // Given the save resolves
  releaseSave();

  // Then the summary shows the new name
  expect(await form.summaryValue("Name")).toHaveTextContent(edited.nom);
});
```

While scaffolding, a narrow test is still allowed — but it opens on its own `Given`, so the merge has legs to join.
