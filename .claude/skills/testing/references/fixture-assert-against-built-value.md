---
title: Assert Against What the Factory Returned
impact: MEDIUM
impactDescription: the seed and the assertion cannot disagree
tags: fixtures, assertions
---

## Assert Against What the Factory Returned

The seed hands the record back so the assertion reads from it. A string typed twice — once in the seed, once in the matcher — is a value the test now depends on, and a factory that stops handing it out breaks nothing until someone edits one copy.

**Incorrect (the value repeated by hand):**

```tsx
await seedAccount({ nom: "Lovelace" });
const page = renderAccountPage();
expect(await page.summaryValue("Name")).toHaveTextContent("Lovelace");
```

**Correct (the built record is the source):**

```tsx
const account = await seedAccount();
const page = renderAccountPage();
expect(await page.summaryValue("Name")).toHaveTextContent(account.nom);
```

**Correct (a value in several forms, fed as one and asserted as another):**

```tsx
const phone = createFrenchPhone();
await form.changePhone(phone.formatted);
await form.saveForm();
expect(await form.summaryValue("Phone")).toHaveTextContent(phone.national);
expect(accounts.findFirst()).toMatchObject({ telephone: phone.e164 });
```
