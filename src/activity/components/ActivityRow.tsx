import * as stylex from "@stylexjs/stylex";
import { formatWhen } from "../helpers/activity";
import { KIND_LABELS, type ActivityKind } from "../helpers/kinds";
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
 * The props are this component's own, named for what it renders, rather than
 * `entry: ActivityEntry`. A row is a UI concern and the entry is a data type:
 * they change for different reasons, and handing over the server's record binds
 * every field rename on the wire to a component that only ever paints four
 * strings and a flag.
 *
 * `hasNote` is the clearest case. The row shows THAT there is a note, never the
 * text of one, so the text is not this component's business — and a prop that
 * said `note: string` would quietly invite it to become so.
 *
 * Presentational, and strictly so: it fetches nothing and stores nothing. Which
 * entry is selected and what happens on a click both belong to the list, and
 * that is what keeps this renderable from a fixture in isolation.
 */
export interface ActivityRowProps {
  /** Reported back on click; the row itself never reads it. */
  id: string;
  kind: ActivityKind;
  /** ISO 8601, formatted for reading here. */
  at: string;
  summary: string;
  /** Null when the request carried nothing to say where from. */
  device: string | null;
  hasNote: boolean;
  selected: boolean;
  onSelect: (entryId: string) => void;
}

export function ActivityRow({
  id,
  kind,
  at,
  summary,
  device,
  hasNote,
  selected,
  onSelect,
}: ActivityRowProps) {
  // Derived on each render from what this row was handed. Nothing to store, so
  // nothing that can disagree with the row beside it.
  const where = device ?? "an unrecognised device";

  return (
    <button
      type="button"
      // `aria-pressed` and not `aria-selected`: this is a toggle in a list of
      // buttons, not an option in a listbox, and claiming the second would
      // promise keyboard semantics this markup does not implement.
      aria-pressed={selected}
      onClick={() => onSelect(id)}
      {...stylex.props(styles.row, selected && styles.rowSelected)}
    >
      <span {...stylex.props(styles.badge)}>{KIND_LABELS[kind]}</span>
      <span {...stylex.props(styles.body)}>
        <span {...stylex.props(styles.summary)}>{summary}</span>
        <span {...stylex.props(styles.meta)}>
          {formatWhen(at)} · {where}
          {hasNote && <span {...stylex.props(styles.noted)}> · noted</span>}
        </span>
      </span>
    </button>
  );
}
