import * as stylex from "@stylexjs/stylex";
import { ErrorBoundary, type FallbackRender } from "@sentry/react";
import { CrashScreen } from "./CrashScreen";
import { colors, space, text } from "@demo/tokens/tokens.stylex";

/**
 * The last thing between a render that threw and a blank document.
 *
 * It sits OUTSIDE the router (see ../main.tsx), and since the router became a
 * React Router data router that is now a narrower job than it reads like: what
 * a ROUTE throws never reaches here, because the data router catches it first
 * and hands it to ./RouteErrorBoundary. What is left for this one is everything
 * the router cannot catch on its own behalf - the providers above it, the
 * <RouterProvider> itself, the route tree failing to build - which is precisely
 * the case that needs a fallback owing nothing to the router still standing.
 *
 * That is also why it draws its own shell around ../layout/CrashScreen: there is
 * no <Outlet>, and no ./RootLayout, left to render inside.
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
});

/**
 * The fallback, and the arrow that renders it, both at module scope: a component
 * defined inside another one is a NEW type on every render, which React unmounts
 * and remounts rather than updates. Harmless for a screen with no state, wrong
 * the moment it grows any - and the linter is right to say so either way.
 *
 * `resetError` re-mounts the tree that threw, which is worth offering because
 * the common cause is transient - a failed chunk, a state the route cannot
 * recover from - and worth NOT hiding behind a full reload, which would throw
 * away everything else on the page.
 */
const renderCrashScreen: FallbackRender = ({ resetError }) => (
  <div {...stylex.props(styles.shell)}>
    <CrashScreen onRetry={resetError} />
  </div>
);

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary fallback={renderCrashScreen}>{children}</ErrorBoundary>;
}
