# Managing the account — run history

## 2026-08-25 — "Reading your account"

### Applied — E2E

| File                  | Use case                                   | Kind       | Covers                                                                                                                                                                                                                                                                                             | Applied       |
| --------------------- | ------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `e2e/account.spec.ts` | Reading your account, Editing your account | Happy path | the whole journey against the real API: opens the welcome, follows the nav to the summary, reads every stored field, opens the form, fills it the way a user fills it — name, first name, email, phone, language, bio — saves, and lands back on the summary showing every value the API gave back | ✍️ 2026-08-25 |

### Applied — Integration page

| File                                                     | Use case             | Kind           | Covers                                                                                                                                                                                                                                                                                                             | Applied       |
| -------------------------------------------------------- | -------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| `src/account/__tests__/AccountPage.integration.test.tsx` | Reading your account | Default render | the account arrives: the loading status while the answer is held, then the heading, the six terms — Name, First name, Email, Phone, Language, Bio — each showing the stored value, the phone in national format, the language as its label rather than the stored code, the edit link, and the loading status gone | ✅ 2026-08-25 |
| `src/account/__tests__/AccountPage.integration.test.tsx` | Reading your account | Happy path     | follows the edit link and lands on the form                                                                                                                                                                                                                                                                        | ✅ 2026-08-25 |
| `src/account/__tests__/AccountPage.integration.test.tsx` | Reading your account | Edge case      | an account with no phone and an empty bio: both rows read "Not provided", every other row still shows its value                                                                                                                                                                                                    | ✅ 2026-08-25 |
| `src/account/__tests__/AccountPage.integration.test.tsx` | Reading your account | Edge case      | the load fails: the error alert, and no summary                                                                                                                                                                                                                                                                    | ✅ 2026-08-25 |

### Applied — Integration component

| File                                                   | Function   | Kind       | Page use case                              | Covers                                                                                                                                                                                                                                         | Applied       |
| ------------------------------------------------------ | ---------- | ---------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `src/layout/__tests__/Navigation.integration.test.tsx` | Navigation | Happy path | Reading your account, Editing your account | the shell's map from every route: on the welcome, Home is marked `aria-current="page"` and Your account is not; following Your account lands on the summary and the mark moves; from the edit form, Home takes the visitor back to the welcome | ✅ 2026-08-25 |

### Applied — Unit

| File                                               | Function                                 | Page use case                              | Covers                                                                                                                                                                                                                                           | Applied       |
| -------------------------------------------------- | ---------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| `src/account/helpers/__tests__/phone.unit.test.ts` | `parseFrenchPhone`, `isValidFrenchPhone` | Reading your account, Editing your account | 7 accepted shapes (spaced, dotted, dashed, plain, +33, 0033, landline) all reaching one canonical e164/national pair, 4 rejection reasons (empty, invalid_chars, wrong_length, invalid_prefix), and `isValidFrenchPhone` agreeing with the parse | ✅ 2026-08-25 |
| `src/account/helpers/__tests__/api.unit.test.ts`   | `toValues`, `toPayload`                  | Reading your account, Editing your account | the phone conversions the two shapes disagree on: stored E.164 to national, `null` to empty string, an unparseable stored value to empty string, national to E.164, empty string to `null`                                                       | ✅ 2026-08-25 |

### Written, not run

- The E2E row above, `e2e/account.spec.ts`. The command is `yarn e2e`. The missing precondition is its own server chain: `playwright.config.ts` starts `yarn api:start` on :3001 and `yarn build && yarn preview` on :4173, neither was already up, and the second is a full production build this run would have had to pay before a single assertion ran.
- No earlier ✍️ row existed, so none was turned ✅.

### Blind spots

None closed. The four blind spots this slice could have reached (1, 2, 3 and 6) all sit on `EditAccountPage`, which belongs to the "Editing your account" slice; 4 and 5 the plan leaves open with its own reasons.

### Query handles

- `src/account/components/SummaryRow.tsx` — the `<dt>` gained an `id`, and the `<dd>` an `aria-labelledby` pointing at it, so a summary value can be reached by the term it belongs to rather than by a test id. That reaches rung 1 of the query ladder, role plus accessible name, and the assertions now prove the term/value _pairing_ rather than that a string is somewhere on the page.

  The `<dd>` also carries an explicit `role="group"`. This was not the shape the plan assumed: `aria-labelledby` alone leaves the element's implicit role at `definition`, and Playwright's name computation does not name a `definition`, so `getByRole("definition", { name })` matched nothing however the element was labelled. `role="group"` is what makes the accessible name reachable. It overrides the implicit `definition` role in the accessibility tree — the markup, the styling and the `data-testid`s are untouched, but that override is a real semantic change and is the developer's to keep or reject.

### Numbers

**Coverage** - the 11 files under `## Census` in `inventory.md` that the coverage report carries at both ends

| Statements     | Branches       |
| -------------- | -------------- |
| 88.52 -> 85.93 | 78.21 -> 72.22 |

The whole drop falls on `SummaryRow.tsx` (statements 27/27 -> 20/27, branches 20/20 -> 10/21), whose own test file the plan dropped: one page mounts `SummaryRow`, so its contract moved inside that page's journeys. The ledger meant to lose it. Every other census file reads identically at both ends — `AccountPage.tsx` 39/53 statements and 23/42 branches before and after — so the page merge itself lost nothing. The branch _total_ moved 179 -> 180 because the query-handle edit added a node to `SummaryRow.tsx`.

**Test count per level**

| Level                 | Files  | Cases    |
| --------------------- | ------ | -------- |
| E2E                   | 1 -> 1 | 1 -> 1   |
| Integration page      | 1 -> 1 | 39 -> 4  |
| Integration component | 2 -> 1 | 20 -> 1  |
| Unit                  | 2 -> 2 | 35 -> 19 |

Whole suite, every level Vitest runs: 9 files / 156 cases -> 8 files / 86 cases. The unit figure counts `it.each` rows as the runner counts them — one row per case — where the plan counts each `it.each` as the single row it is written as.

### Notes

- `e2e/account.spec.ts` imported `createUser` from `@account/mocks/db-utils`, which exports no such symbol. The spec could not have compiled, and nothing caught it because the E2E directory sits outside both Vitest projects and `yarn e2e` needs a build to run. It now uses `accountFactory.build`. Worth knowing before trusting any earlier claim that the E2E level was green.
- No `vi.mock` remains in `AccountPage.integration.test.tsx`. The four blocks it carried (`use-account`, `SummaryRow`, `api`, `validation`) and the `mockQueryResult()` stub are gone; the journeys cross the MSW seam instead. `EditAccountPage.integration.test.tsx` has not been looked at yet and may still carry its own.
- Two locators need `exact: true`, and both will bite again: "Your account" is a case-insensitive substring of "Edit your account", and "Name" of "First name". Role-name matching is substring by default, so without it the heading assertion after navigating finds the wrong heading and the summary lookup raises a strict-mode violation.
- Running `yarn verify` whole will fail at `oxfmt --check` on untracked markdown under `.claude/skills/`, which no run here has touched. Format and check named paths instead.

## 2026-08-25 — "Editing your account"

### Applied — Integration page

| File                                                         | Use case             | Kind           | Covers                                                                                                                                                                                                                                                                                                                                                                                                    | Applied       |
| ------------------------------------------------------------ | -------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `src/account/__tests__/EditAccountPage.integration.test.tsx` | Editing your account | Default render | the form arrives: the loading status while the answer is held, then every field seeded from the stored account — name, first name, email, phone in national format, language selected, bio — the language select offering 🆕 its "Choose a language" placeholder beside French and English, Save enabled, no error message on any field                                                                   | ✅ 2026-08-25 |
| `src/account/__tests__/EditAccountPage.integration.test.tsx` | Editing your account | Happy path     | edits every field of an account stored with no phone, saves, sees Save disabled and relabelled "Saving..." while the answer is held, then lands on the summary showing every new value with the entered phone in national format — and the store holds the phone in E.164                                                                                                                                 | ✅ 2026-08-25 |
| `src/account/__tests__/EditAccountPage.integration.test.tsx` | Editing your account | Edge case      | the form is rejected: name cleared, email invalid, 🆕 phone invalid, language back on the placeholder — each field flagged with its own message ("Name is required", "Email is invalid", 🆕 "Phone number is invalid", "Language is required"), each flagged input carrying `aria-invalid` and pointing at its message, nothing sent, and 🆕 correcting one field clears its message without another Save | ✅ 2026-08-25 |
| `src/account/__tests__/EditAccountPage.integration.test.tsx` | Editing your account | Edge case      | the save fails: the visitor stays on the form, "Something went wrong" appears, nothing is persisted, and editing any field clears the banner                                                                                                                                                                                                                                                              | ✅ 2026-08-25 |
| `src/account/__tests__/EditAccountPage.integration.test.tsx` | Editing your account | Edge case      | 🆕 the edit is abandoned: Cancel returns to the summary and the stored account is unchanged                                                                                                                                                                                                                                                                                                               | ✅ 2026-08-25 |
| `src/account/__tests__/EditAccountPage.integration.test.tsx` | Editing your account | Edge case      | the account fails to load: the error alert, and no form fields                                                                                                                                                                                                                                                                                                                                            | ✅ 2026-08-25 |

### Applied — Unit

| File                                                    | Function        | Page use case        | Covers                                                                                                                                                                                                                                                                       | Applied       |
| ------------------------------------------------------- | --------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `src/account/helpers/__tests__/validation.unit.test.ts` | `accountSchema` | Editing your account | each rejection reason (empty and whitespace-only name, empty first name, empty and malformed email, phone with letters, phone too short, placeholder language) and each boundary it distinguishes (bio at 200 accepted, at 201 rejected; empty phone and empty bio accepted) | ✅ 2026-08-25 |

### Written, not run

- No row this run left ✍️, and none turned ✅. The feature's one standing ✍️ row, `e2e/account.spec.ts`, was not chosen for this slice and is still owed a run. The command is `yarn e2e`; the missing precondition is unchanged — `playwright.config.ts` starts `yarn api:start` on :3001 and `yarn build && yarn preview` on :4173, neither was up (`curl` to both refused the connection), and the second is a full production build this run would have paid before a single assertion ran.

### Blind spots

Four closed, all inside tests this run merged — none needed a test of its own:

1. the edit form's own message for an invalid phone, "Phone number is invalid" — `EditAccountPage.integration.test.tsx`, "rejects the form when every field is invalid, flags each one, sends nothing, and clears a message the moment it is corrected"
2. the Cancel link is never clicked — `EditAccountPage.integration.test.tsx`, "abandons the edit: Cancel returns to the summary leaving the stored account unchanged"
3. correcting a field after a rejected save clears its message live, without another Save — same test as 1, which corrects the name alone after the rejection and asserts the message goes on its own
4. the language select's placeholder option reads "Choose a language" — `EditAccountPage.integration.test.tsx`, "shows a loading state, then every field seeded from the stored account"

### Query handles

None. Every assertion reached its node through a role, label or accessible name `EditAccountPage.tsx`, `FieldError.tsx` and `SummaryRow.tsx` already carried — the `SummaryRow` handles the previous run raised were enough for the post-save summary reads. No source file was edited by this run.

### Numbers

**Coverage** - the 11 files under `## Census` in `inventory.md` that the coverage report carries at both ends

| Statements     | Branches       |
| -------------- | -------------- |
| 85.93 -> 87.04 | 72.22 -> 73.89 |

Both rose while 57 cases left the suite. The whole gain falls on the two files the slice touched: `FieldError.tsx` 16/19 -> 18/19 statements and 10/15 -> 13/15 branches, `EditAccountPage.tsx` 95/105 -> 96/105 statements. `FieldError` rising _after_ its own test file was deleted is the drop's own argument made in numbers — the page journey mounts it against the real form and reaches branches the isolated component test did not. Every other census file reads identically at both ends, so nothing else moved.

**Test count per level**

| Level                 | Files  | Cases    |
| --------------------- | ------ | -------- |
| Integration page      | 1 -> 1 | 11 -> 6  |
| Integration component | 1 -> 0 | 16 -> 0  |
| Unit                  | 1 -> 1 | 33 -> 13 |

Over the three files this run touched. Whole suite, every level Vitest runs: 8 files / 86 cases -> 7 files / 45 cases. The unit figure counts `it.each` rows as the runner counts them — 13 — where the plan counts the two `it.each` tables as the rows they are written as.

### Notes

- **Two inventory lines lost their tests without a disposition on the plan.** `validation.unit.test.ts:117` (an international-format telephone is accepted) and `:139` (langue "en" is accepted) were neither in the approved row's **Covers** cell nor in the **Dropped** table, and the merge rewrote the file without them. The acceptance table's base `valid` fixture is `telephone: "0612345678"`, `langue: "fr"`, so the national shape and "fr" are still proved incidentally, and those two are not. Both lines read `OPEN` in `inventory.md`; they belong at the next gate, not in a quiet re-add.
- The merge also deleted the file's dropped lines — `:23,27,31` (Zod's own API) and `:175,179,183,189,193,197` (`LANGUAGES`/`LANGUAGE_LABELS`) — which the plan's **Dropped** table holds but no row handed to the merge. They are this slice's drops and are marked applied; flagged because the agent took the call itself rather than being given it.
- `EditAccountPage.integration.test.tsx` carries no `vi.mock` — this answers the previous run's open note. Both files this run wrote cross the MSW seam only; the sole test double anywhere in the slice is `worker.use(...)` on `ACCOUNT_URL`.
- The plan's ranked blind spots renumbered: the four closed above came out of the list, leaving the two the plan holds open. The previous recap section's "1, 2, 3 and 6" and "4 and 5" refer to the _old_ numbering and were left as written.
- `oxlint` over `src` and `e2e` is clean but for one pre-existing warning in `src/testing/deferred.ts` (`consistent-function-scoping`), which no run has touched. `yarn verify` whole still fails at `oxfmt --check` on untracked markdown under `.claude/skills/` — format and check named paths instead, as the previous run's note says.
