import * as stylex from "@stylexjs/stylex";
import { colors, space, text } from "@demo/tokens/tokens.stylex";

const styles = stylex.create({
  list: {
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: space.md,
    paddingBlock: space.sm,
    borderBottom: `1px solid ${colors.border}`,
  },
  name: {
    fontWeight: 550,
    color: colors.text,
  },
  meta: {
    fontSize: text.sm,
    color: colors.textMuted,
  },
});

interface CityRow {
  code: string;
  name: string;
  postcode: string;
  department: string;
}

/** The matches, in the order they are given. */
export function CityList({ cities }: { cities: CityRow[] }) {
  return (
    <ul {...stylex.props(styles.list)}>
      {cities.map((city) => (
        <li key={city.code} {...stylex.props(styles.row)}>
          <span {...stylex.props(styles.name)}>{city.name}</span>
          <span {...stylex.props(styles.meta)}>
            {city.postcode} · {city.department}
          </span>
        </li>
      ))}
    </ul>
  );
}
