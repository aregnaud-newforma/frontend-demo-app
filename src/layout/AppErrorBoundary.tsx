import * as stylex from "@stylexjs/stylex";
import { ErrorBoundary, type FallbackRender } from "@sentry/react";
import { colors, radius, space, text } from "../tokens.stylex";

/**
 * The last thing between a render that threw and a blank document.
 *
 * It sits OUTSIDE the router (see ../main.tsx), which is the whole point: a
 * crash in RootLayout, in the route tree, or in the router itself has to land
 * somewhere that does not need any of them to still be standing. That is also
 * why the fallback carries its own shell styles instead of reusing
 * ./RootLayout's - there is no <Outlet> left to render inside.
 *
 * Sentry's ErrorBoundary rather than a hand-written one because React gives a
 * component stack to `componentDidCatch` and nowhere else: the global
 * `window.onerror` handler the SDK already installs would report the error
 * either way, but with no idea WHICH component was rendering. It is still a
 * plain React error boundary when the DSN is unset and nothing is reported, so
 * `yarn dev` and the browser tests get the fallback too.
 */
const styles = stylex.create({
  shell: {
    maxWidth: 640,
    marginInline: "auto",
    paddingBlock: space.xxl,
    paddingInline: space.lg,
    fontFamily: text.family,
    fontSize: text.base,
    lineHeight: 1.55,
    color: colors.text,
  },
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

/**
 * The fallback, and the arrow that renders it, both at module scope: a component
 * defined inside another one is a NEW type on every render, which React unmounts
 * and remounts rather than updates. Harmless for a screen with no state, wrong
 * the moment it grows any - and the linter is right to say so either way.
 */
function CrashScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div {...stylex.props(styles.shell)}>
      <div role="alert" data-testid="app-error" {...stylex.props(styles.panel)}>
        <h1 {...stylex.props(styles.title)}>Something went wrong</h1>

        <p {...stylex.props(styles.body)}>
          The page could not be displayed. The problem has been reported.
        </p>

        {/* `resetError` re-mounts the tree that threw. It is worth offering
            because the common cause is transient - a failed chunk, a state the
            route cannot recover from - and worth NOT hiding behind a full
            reload, which would throw away everything else on the page. */}
        <button type="button" onClick={onRetry} {...stylex.props(styles.retry)}>
          Try again
        </button>
      </div>
    </div>
  );
}

const renderCrashScreen: FallbackRender = ({ resetError }) => <CrashScreen onRetry={resetError} />;

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary fallback={renderCrashScreen}>{children}</ErrorBoundary>;
}
