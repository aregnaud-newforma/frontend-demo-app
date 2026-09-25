import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

/**
 * One labelled value on the account summary.
 *
 * The web renders a <dt>/<dd> pair straight into a grid, and the pairing is
 * what its tests assert on - a value found under the wrong label is a bug the
 * markup can express. Native has no description list, so the pair is a row and
 * the pairing is made explicit for the accessibility tree instead:
 * `accessibilityLabel` on the group carries the term, so a screen reader
 * announces "Email, someone@example.com" as one thing rather than two adjacent
 * strings.
 *
 * Stacked rather than two columns: 10rem of label beside the value reads well
 * on a laptop and squeezes an email onto four lines on a phone. The web makes
 * the same call below 30rem.
 */

const styles = StyleSheet.create((theme) => ({
  row: {
    gap: theme.space.xs,
  },
  term: {
    fontSize: theme.text.sm,
    fontWeight: "600",
    color: theme.colors.textMuted,
  },
  value: {
    fontSize: theme.text.base,
    color: theme.colors.text,
  },
}));

export function SummaryRow({ term, children }: { term: string; children: ReactNode }) {
  const slug = term.toLowerCase().replaceAll(/\s+/g, "-");

  return (
    <View accessible accessibilityLabel={term} testID={`summary-row-${slug}`} style={styles.row}>
      <Text style={styles.term}>{term}</Text>
      {/* The testID names the TERM, which is what makes "every field" a real
          check: a value rendered under the wrong label carries the wrong id
          here, exactly as it would carry the wrong <dt> on the web. */}
      <Text testID={`summary-value-${slug}`} style={styles.value}>
        {children}
      </Text>
    </View>
  );
}
