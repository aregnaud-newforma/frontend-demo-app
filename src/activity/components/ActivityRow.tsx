import * as stylex from "@stylexjs/stylex";
import { formatWhen } from "../helpers/activity";
import { KIND_LABELS } from "../helpers/kinds";
import type { ActivityEntry } from "../helpers/api";
import { colors, radius, space, text } from "../../tokens.stylex";

const styles = stylex.create({
  row: {
    display: "flex",
    alignItems: "flex-start",
    gap: space.md,
    width: "100%",
    paddingBlock: space.md,
    paddingInline: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: { default: "transparent", ":hover": colors.border },
    backgroundColor: { default: "transparent", ":hover": colors.accentSoft },
    textAlign: "left",
    cursor: "pointer",
    color: colors.text,
    fontFamily: text.family,
    fontSize: text.base,
  },
  // Applied after `row` in the same props() call, so it wins by argument order.
  rowSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  body: {
    display: "flex",
    flexDirection: "column",
    gap: space.xs,
    minWidth: 0,
  },
  summary: {
    margin: 0,
    fontWeight: 550,
  },
  meta: {
    margin: 0,
    fontSize: text.sm,
    color: colors.textMuted,
  },
  // A fixed width rather than one per label: "Sign-ins" and "Profile changes"
  // are five characters apart, and letting each badge size itself would start
  // every summary at a different x down the list.
  badge: {
    flexShrink: 0,
    width: "7.5rem",
    textAlign: "center",
    paddingBlock: space.xs,
    paddingInline: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.border,
    fontSize: text.sm,
    color: colors.textMuted,
  },
  noted: {
    color: colors.accent,
  },
});

/**
 * One line of the log.
 *
 * Takes the whole `ActivityEntry` rather than the four fields it renders. The
 * row exists to show an entry and nothing else, so its props have no life of
 * their own: a field added to the server's shape is a field this row may have
 * to show, and spelling out a private four-field type here would only mean
 * editing two places to find that out. Decoupling is for props that were never
 * going to follow the entity — a `selected` flag and an `onSelect`, which the
 * list owns and the server has never heard of.
 *
 * Presentational, and strictly so: it fetches nothing and stores nothing. Which
 * entry is selected and what happens on a click both belong to the list, and
 * that is what keeps this renderable from a fixture in isolation.
 */
export interface ActivityRowProps {
  entry: ActivityEntry;
  selected: boolean;
  onSelect: (entryId: string) => void;
}

export function ActivityRow({ entry, selected, onSelect }: ActivityRowProps) {
  // Derived on each render from what this row was handed. Nothing to store, so
  // nothing that can disagree with the entry beside it.
  const where = entry.device ?? "an unrecognised device";
  const hasNote = entry.note.trim() !== "";

  return (
    <button
      type="button"
      // `aria-pressed` and not `aria-selected`: this is a toggle in a list of
      // buttons, not an option in a listbox, and claiming the second would
      // promise keyboard semantics this markup does not implement.
      aria-pressed={selected}
      onClick={() => onSelect(entry.id)}
      {...stylex.props(styles.row, selected && styles.rowSelected)}
    >
      <span {...stylex.props(styles.badge)}>{KIND_LABELS[entry.kind]}</span>
      <span {...stylex.props(styles.body)}>
        <span {...stylex.props(styles.summary)}>{entry.summary}</span>
        <span {...stylex.props(styles.meta)}>
          {formatWhen(entry.at)} · {where}
          {hasNote && <span {...stylex.props(styles.noted)}> · noted</span>}
        </span>
      </span>
    </button>
  );
}
