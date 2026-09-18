/**
 * Integration coverage for ActivityPage - the log a visitor searches, filters
 * and annotates, at "/activity".
 */
import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { worker } from "@testing/worker";
import { deferred } from "@testing/deferred";
import { renderRoute } from "@testing/render-route";
import { seedAccount } from "@account/mocks/db-utils";
import { activity } from "../mocks/db";
import { ACTIVITY_URL, NOTE_URL } from "../mocks/handlers";
import { seedActivity } from "../mocks/db-utils";

/*
 * Integration: page
 */

/**
 * The setup function for this file. Apply AHA Testing principle.
 */
async function renderActivityPage() {
  const screen = await renderRoute("/activity");

  return {
    searchInput: () => screen.getByLabelText("Search activity"),
    status: () => screen.getByRole("status"),
    errorBanner: () => screen.getByRole("alert"),
    emptyState: () => screen.getByText("Nothing here matches what you are looking for."),

    /** One row, by the summary a visitor reads on it. */
    row: (summary: string) => screen.getByRole("button", { name: new RegExp(summary) }),
    /** The filter control for one kind, by its label and count, e.g. "Security (1)". */
    kindFilter: (label: string) => screen.getByRole("checkbox", { name: new RegExp(label) }),

    notePanel: () => screen.getByRole("region", { name: "Note" }),
    noteInput: () => screen.getByLabelText("Your note"),
    noteRemaining: () => screen.getByText(/characters remaining/),
    saveNoteButton: () => screen.getByRole("button", { name: "Save note", exact: true }),
    savingNoteButton: () => screen.getByRole("button", { name: "Saving...", exact: true }),

    search: (value: string) => screen.getByLabelText("Search activity").fill(value),
    toggleKind: (label: string) =>
      screen.getByRole("checkbox", { name: new RegExp(label) }).click(),
    selectRow: (summary: string) =>
      screen.getByRole("button", { name: new RegExp(summary) }).click(),
    writeNote: (value: string) => screen.getByLabelText("Your note").fill(value),
    saveNote: () => screen.getByRole("button", { name: "Save note", exact: true }).click(),
  };
}

/** The log every journey below starts from: one entry of each kind. */
async function seedThreeKinds() {
  return seedActivity([
    {
      id: "sign-in-1",
      kind: "sign-in",
      at: "2026-01-03T12:00:00.000Z",
      summary: "Signed in from a new device",
      device: "Chrome on macOS",
    },
    {
      id: "profile-1",
      kind: "profile-change",
      at: "2026-01-02T12:00:00.000Z",
      summary: "Changed your email address",
      device: "Safari on iPhone",
    },
    {
      id: "security-1",
      kind: "security",
      at: "2026-01-01T12:00:00.000Z",
      summary: "Two-factor authentication enabled",
      device: null,
    },
  ]);
}

// Use case: Reading your activity — Default render
it("shows a loading state, then every entry newest first, counted against the whole log", async () => {
  // Given a seeded log, with its GET held open
  await seedAccount();
  await seedThreeKinds();
  const { promise: activityArrives, resolve: releaseActivity } = deferred<void>();
  worker.use(
    http.get(ACTIVITY_URL, async () => {
      await activityArrives;
      return HttpResponse.json(activity.findMany());
    }),
  );
  const page = await renderActivityPage();

  // Then the page says it is loading
  await expect.element(page.status()).toHaveTextContent("Loading your activity...");

  // Given the log arrives
  releaseActivity();

  // Then every entry is on the page, counted against the whole log
  await expect.element(page.status()).toHaveTextContent("Showing 3 of 3 entries");
  await expect.element(page.row("Signed in from a new device")).toBeVisible();
  await expect.element(page.row("Changed your email address")).toBeVisible();
  await expect.element(page.row("Two-factor authentication enabled")).toBeVisible();

  // And each filter carries its own count, including the entry with no device
  await expect.element(page.kindFilter("Sign-ins")).toBeVisible();
  await expect.element(page.kindFilter("Security \\(1\\)")).toBeVisible();

  // And nothing is selected, so no note panel is offered yet
  await expect.element(page.notePanel()).not.toBeInTheDocument();
});

// Use case: Reading your activity — Happy path
it("narrows the log by search and by kind, and keeps the counts describing the whole log", async () => {
  // Given a loaded log
  await seedAccount();
  await seedThreeKinds();
  const page = await renderActivityPage();
  await expect.element(page.status()).toHaveTextContent("Showing 3 of 3 entries");

  // When the visitor searches for a word only one entry carries
  await page.search("email");

  // Then only that entry is left, and the count still names the whole log
  await expect.element(page.status()).toHaveTextContent("Showing 1 of 3 entries");
  await expect.element(page.row("Changed your email address")).toBeVisible();
  await expect.element(page.row("Signed in from a new device")).not.toBeInTheDocument();

  // And the filter counts are unchanged - they describe the log, not the view
  await expect.element(page.kindFilter("Sign-ins \\(1\\)")).toBeVisible();

  // When the visitor clears the search and filters to security instead
  await page.search("");
  await expect.element(page.status()).toHaveTextContent("Showing 3 of 3 entries");
  await page.toggleKind("Security");

  // Then only the security entry survives
  await expect.element(page.status()).toHaveTextContent("Showing 1 of 3 entries");
  await expect.element(page.row("Two-factor authentication enabled")).toBeVisible();
  await expect.element(page.row("Changed your email address")).not.toBeInTheDocument();
});

// Use case: Annotating an entry — Happy path
it("saves a note on the selected entry and marks the row as noted", async () => {
  // Given a loaded log
  await seedAccount();
  await seedThreeKinds();
  const page = await renderActivityPage();
  await expect.element(page.status()).toHaveTextContent("Showing 3 of 3 entries");

  // When the visitor picks an entry
  await page.selectRow("Two-factor authentication enabled");

  // Then the panel opens on it, empty, with Save unavailable until something changes
  await expect.element(page.notePanel()).toBeVisible();
  await expect.element(page.noteInput()).toHaveValue("");
  await expect.element(page.noteRemaining()).toHaveTextContent("280 of 280 characters remaining");
  await expect.element(page.saveNoteButton()).toBeDisabled();

  // When they write a note, with the save held open
  const { promise: saveArrives, resolve: releaseSave } = deferred<void>();
  worker.use(
    http.put(NOTE_URL, async ({ params, request }) => {
      await saveArrives;
      const body = (await request.json()) as { note: string };
      const entry = activity.findFirst((query) => query.where({ id: String(params.entryId) }))!;
      const updated = await activity.update(entry, {
        strict: true,
        data(draft) {
          draft.note = body.note;
        },
      });
      return HttpResponse.json(updated);
    }),
  );
  await page.writeNote("Was me, on the new laptop.");

  // Then the counter follows what was typed
  await expect.element(page.noteRemaining()).toHaveTextContent("254 of 280 characters remaining");

  // When they save
  await page.saveNote();

  // Then the button says so while it is in flight
  await expect.element(page.savingNoteButton()).toBeDisabled();

  // Given the save resolves
  releaseSave();

  // Then the row reports it carries a note, and the store holds it
  await expect.element(page.row("Two-factor authentication enabled")).toHaveTextContent("noted");
  expect(activity.findFirst((query) => query.where({ id: "security-1" }))).toMatchObject({
    note: "Was me, on the new laptop.",
  });
});

// Use case: Annotating an entry — Edge case
it("never shows one entry's draft note under another entry", async () => {
  // Given a loaded log with a note already stored on one entry
  await seedAccount();
  await seedThreeKinds();
  await activity.update(
    activity.findFirst((query) => query.where({ id: "profile-1" }))!,
    {
      strict: true,
      data(draft) {
        draft.note = "Checked with support.";
      },
    },
  );
  const page = await renderActivityPage();
  await expect.element(page.status()).toHaveTextContent("Showing 3 of 3 entries");

  // When the visitor starts a note on one entry without saving it
  await page.selectRow("Signed in from a new device");
  await page.writeNote("Half-written thought");

  // And switches to a different entry
  await page.selectRow("Changed your email address");

  // Then the panel shows the SECOND entry's stored note, not the abandoned draft
  await expect.element(page.notePanel()).toHaveTextContent("Changed your email address");
  await expect.element(page.noteInput()).toHaveValue("Checked with support.");
});

// Use case: Annotating an entry — Edge case
it("stays on the entry and says so when the note is refused", async () => {
  // Given a loaded log and a server that refuses the save
  await seedAccount();
  await seedThreeKinds();
  worker.use(http.put(NOTE_URL, () => new HttpResponse(null, { status: 500 })));
  const page = await renderActivityPage();
  await expect.element(page.status()).toHaveTextContent("Showing 3 of 3 entries");

  // When the visitor writes a note and saves
  await page.selectRow("Signed in from a new device");
  await page.writeNote("Not sure this was me.");
  await page.saveNote();

  // Then they are told, with the text they typed still there
  await expect.element(page.errorBanner()).toHaveTextContent("That note could not be saved");
  await expect.element(page.noteInput()).toHaveValue("Not sure this was me.");

  // And nothing was persisted
  expect(activity.findFirst((query) => query.where({ id: "sign-in-1" }))).toMatchObject({
    note: "",
  });
});

// Use case: Reading your activity — Edge case
it("offers an empty state rather than a bare list when a search matches nothing", async () => {
  // Given a loaded log
  await seedAccount();
  await seedThreeKinds();
  const page = await renderActivityPage();
  await expect.element(page.status()).toHaveTextContent("Showing 3 of 3 entries");

  // When the visitor searches for something that is not there
  await page.search("telepathy");

  // Then they are told, rather than left looking at nothing
  await expect.element(page.emptyState()).toBeVisible();
  await expect.element(page.status()).toHaveTextContent("Showing 0 of 3 entries");
});

// Use case: Reading your activity — Edge case
it("shows an error and no filters when the log fails to load", async () => {
  // Given a server that fails the load
  await seedAccount();
  worker.use(http.get(ACTIVITY_URL, () => new HttpResponse(null, { status: 500 })));

  // When the visitor opens the page
  const page = await renderActivityPage();

  // Then they see the error, and are given no controls that would do nothing
  await expect.element(page.errorBanner()).toBeVisible();
  await expect
    .element(page.errorBanner())
    .toHaveTextContent("Could not load your activity. Please try again.");
  await expect.element(page.searchInput()).not.toBeInTheDocument();
});
