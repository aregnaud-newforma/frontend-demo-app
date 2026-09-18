import * as stylex from "@stylexjs/stylex";
import { ACTIVITY_KINDS, KIND_LABELS, type ActivityKind } from "../helpers/kinds";
import { colors, radius, space, text } from "../../tokens.stylex";

const styles = stylex.create({
  fieldset: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.sm,
    margin: 0,
    padding: 0,
    borderStyle: "none",
  },
  legend: {
    padding: 0,
    marginRight: space.sm,
    fontSize: text.sm,
    fontWeight: 550,
    color: colors.textMuted,
  },
  option: {
    display: "inline-flex",
    alignItems: "center",
    gap: space.xs,
    paddingBlock: space.xs,
    paddingInline: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.border,
    fontSize: text.sm,
    cursor: "pointer",
  },
  optionOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    color: colors.accent,
  },
  count: {
    color: colors.textMuted,
  },
});

/**
 * Which kinds the list is narrowed to.
 *
 * Checkboxes rather than a multi-select: every option is worth showing at once,
 * each carries a count, and none of it needs a popup. Controlled by the page,
 * which owns the selection because the query is keyed on it — this component
 * renders a selection and reports a click, and holds nothing.
 *
 * `counts` is passed in rather than computed here from the entries. This
 * component would then need the whole list to render three numbers, and the
 * numbers it must show are of the UNFILTERED log: a count that dropped to zero
 * the moment you unticked its own box would be a control that erases its own
 * label.
 */
export interface KindFiltersProps {
  selected: ReadonlySet<ActivityKind>;
  counts: Record<ActivityKind, number>;
  onToggle: (kind: ActivityKind) => void;
}

export function KindFilters({ selected, counts, onToggle }: KindFiltersProps) {
  return (
    <fieldset {...stylex.props(styles.fieldset)}>
      <legend {...stylex.props(styles.legend)}>Show</legend>
      {ACTIVITY_KINDS.map((kind) => {
        const on = selected.has(kind);
        return (
          <label key={kind} {...stylex.props(styles.option, on && styles.optionOn)}>
            <input
              type="checkbox"
              name="kinds"
              value={kind}
              checked={on}
              onChange={() => onToggle(kind)}
            />
            {KIND_LABELS[kind]} <span {...stylex.props(styles.count)}>({counts[kind]})</span>
          </label>
        );
      })}
    </fieldset>
  );
}
