import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useSaveNote } from "../hooks/use-activity";
import { formatWhen } from "../helpers/activity";
import { KIND_LABELS } from "../helpers/kinds";
import type { ActivityEntry } from "../helpers/api";
import { colors, radius, shadow, space, text } from "../../tokens.stylex";

/** What a note may hold, shared with the counter under the field. */
export const NOTE_MAX_LENGTH = 280;

const styles = stylex.create({
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heading: {
    margin: 0,
    fontSize: text.base,
    fontWeight: 650,
  },
  meta: {
    margin: 0,
    fontSize: text.sm,
    color: colors.textMuted,
  },
  textarea: {
    width: "100%",
    minHeight: "5rem",
    paddingBlock: space.sm,
    paddingInline: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: { default: colors.border, ":focus": colors.accent },
    backgroundColor: colors.canvas,
    color: colors.text,
    fontFamily: text.family,
    fontSize: text.base,
    outline: "none",
    resize: "vertical",
    boxShadow: { default: null, ":focus": shadow.focus },
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
  },
  hint: {
    margin: 0,
    fontSize: text.sm,
    color: colors.textMuted,
  },
  hintOver: {
    color: colors.danger,
  },
  save: {
    flexShrink: 0,
    whiteSpace: "nowrap",
    paddingBlock: space.sm,
    paddingInline: space.lg,
    borderRadius: radius.sm,
    borderStyle: "none",
    backgroundColor: colors.accent,
    color: colors.accentText,
    fontWeight: 550,
    cursor: { default: "pointer", ":disabled": "not-allowed" },
    opacity: { default: 1, ":hover": 0.9, ":disabled": 0.5 },
  },
  error: {
    margin: 0,
    fontSize: text.sm,
    color: colors.danger,
  },
});

/**
 * The note on one entry.
 *
 * IT DOES NOT RESET ITSELF. Its state is seeded from the entry it was mounted
 * with and never told that a different entry arrived, because it never gets
 * one: `ActivityPage` renders it with `key={entry.id}`, so selecting another
 * entry unmounts this component and mounts a fresh one with the new default.
 *
 * That is the whole reason the key is there, and it is worth saying out loud
 * because the alternative looks so reasonable. An effect watching `entry.id`
 * and calling `setDraft(entry.note)` would do the same thing one render LATE:
 * the new entry's heading would paint above the previous entry's half-typed
 * note, and only then would the effect clear it. Remounting makes the two
 * change in a single pass, with no frame in between where they disagree.
 */
export function ActivityNote({ entry }: { entry: ActivityEntry }) {
  const [draft, setDraft] = useState(entry.note);
  const save = useSaveNote();

  // All three are computed while rendering, from state this component already
  // has. Storing them would mean keeping three more things in step with a
  // textarea that changes on every keystroke.
  const remaining = NOTE_MAX_LENGTH - draft.length;
  const tooLong = remaining < 0;
  const unchanged = draft === entry.note;

  return (
    <section aria-label="Note" {...stylex.props(styles.panel)}>
      <h2 {...stylex.props(styles.heading)}>{entry.summary}</h2>
      <p {...stylex.props(styles.meta)}>
        {KIND_LABELS[entry.kind]} · {formatWhen(entry.at)}
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate({ entryId: entry.id, note: draft.trim() });
        }}
      >
        <label htmlFor="activity-note" {...stylex.props(styles.hint)}>
          Your note
        </label>
        <textarea
          id="activity-note"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-invalid={tooLong || undefined}
          {...stylex.props(styles.textarea)}
        />

        <div {...stylex.props(styles.footer)}>
          <p {...stylex.props(styles.hint, tooLong && styles.hintOver)}>
            {remaining} of {NOTE_MAX_LENGTH} characters remaining
          </p>
          <button
            type="submit"
            disabled={save.isPending || tooLong || unchanged}
            {...stylex.props(styles.save)}
          >
            {save.isPending ? "Saving..." : "Save note"}
          </button>
        </div>
      </form>

      {save.isError && (
        <p role="alert" {...stylex.props(styles.error)}>
          That note could not be saved. Please try again.
        </p>
      )}
    </section>
  );
}
