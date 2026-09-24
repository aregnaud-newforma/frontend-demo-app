import type { ReactNode } from "react";
import * as stylex from "@stylexjs/stylex";
import { colors, text } from "@demo/tokens/tokens.stylex";

const styles = stylex.create({
  term: {
    fontSize: text.sm,
    fontWeight: 550,
    color: colors.textMuted,
  },
  value: {
    margin: 0,
    // Long emails should wrap rather than widen the grid column.
    overflowWrap: "anywhere",
  },
});

export function SummaryRow({ term, children }: { term: string; children: ReactNode }) {
  const slug = term.toLowerCase().replace(/\s+/g, "-");
  const termId = `summary-term-${slug}`;

  return (
    <>
      <dt id={termId} data-testid={termId} {...stylex.props(styles.term)}>
        {term}
      </dt>
      <dd
        role="group"
        aria-labelledby={termId}
        data-testid={`summary-value-${slug}`}
        {...stylex.props(styles.value)}
      >
        {children}
      </dd>
    </>
  );
}
