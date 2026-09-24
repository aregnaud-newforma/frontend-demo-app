import * as stylex from "@stylexjs/stylex";
import { colors, radius, space, text } from "@demo/tokens/tokens.stylex";

/**
 * What a crash looks like to the user, shared by the two boundaries that can
 * catch one: ./AppErrorBoundary outside the router, ./RouteErrorBoundary inside
 * it. One screen, so the two cannot drift into two different apologies.
 *
 * The panel only, with no page shell around it. Inside the router there is
 * already one - ./RootLayout's <main> - and outside it there is none, so which
 * frame to draw is the caller's business and what to say is this file's.
 *
 * `onRetry` is the caller's too: what "again" can mean depends on what caught
 * the error, and the two answers are genuinely different. Each boundary says
 * which one it passes.
 */
const styles = stylex.create({
  panel: {
    backgroundColor: colors.dangerSoft,
    border: `1px solid ${colors.danger}`,
    borderRadius: radius.lg,
    padding: space.xl,
  },
  title: { margin: 0, marginBottom: space.md, fontSize: text.lg, fontWeight: 650 },
  body: { margin: 0, marginBottom: space.xl, color: colors.textMuted },
  retry: {
    paddingBlock: space.sm,
    paddingInline: space.lg,
    borderRadius: radius.md,
    borderWidth: 0,
    backgroundColor: colors.accent,
    color: colors.accentText,
    fontFamily: "inherit",
    fontSize: text.sm,
    fontWeight: 550,
    cursor: "pointer",
  },
});

export function CrashScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" data-testid="app-error" {...stylex.props(styles.panel)}>
      <h1 {...stylex.props(styles.title)}>Something went wrong</h1>

      <p {...stylex.props(styles.body)}>
        The page could not be displayed. The problem has been reported.
      </p>

      <button type="button" onClick={onRetry} {...stylex.props(styles.retry)}>
        Try again
      </button>
    </div>
  );
}
