import * as stylex from "@stylexjs/stylex";
import { colors } from "../tokens.stylex";

/**
 * What the page's slot shows while the router fetches a page from its remote -
 * the `HydrateFallback` in ../routes.tsx. A status, announced politely, the
 * same way a page announces its own waiting (see
 * ../account/components/PageState); the sentence is the shell's because the
 * shell does not yet know which page is coming.
 */
const styles = stylex.create({
  status: {
    margin: 0,
    color: colors.textMuted,
  },
});

export function PageLoading() {
  return (
    <p role="status" {...stylex.props(styles.status)}>
      Loading...
    </p>
  );
}
