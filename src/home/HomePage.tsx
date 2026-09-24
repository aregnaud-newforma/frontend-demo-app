import { lazy, Suspense } from "react";
import * as stylex from "@stylexjs/stylex";
import { ErrorBoundary } from "@sentry/react";
import { Link } from "react-router";
import { colors, radius, space, text } from "@demo/tokens/tokens.stylex";

/**
 * The landing route. "/" used to forward straight to the summary; it now holds
 * a page of its own, so the redirect is gone from ../routes.
 *
 * No data of its own: the welcome reads the same whoever opens it, so this
 * page runs no query and has no loading or error branch of its own. The one
 * thing on it that varies - whose account this is - it borrows.
 */

/**
 * The account's preview, from the account vertical: a component from ANOTHER
 * remote, reached the way the shell reaches this page - over the wire, by
 * `<remote>/<key>` (vite.home.config.ts says this build consumes `account`).
 * Not `@account/components/AccountPreview`: that would bundle the account's
 * query and API shape into THIS build, and the two verticals would then have to
 * deploy together for a change to either to be safe.
 *
 * `lazy` because a federated module arrives asynchronously, and `Suspense` is
 * how a component tree waits for one. The boundary under it is the cost of
 * consuming another deployment, made visible: if the account remote is down,
 * only the preview goes, the welcome still renders. Sentry's ErrorBoundary
 * rather than a hand-written one for the same reason ../layout/AppErrorBoundary
 * uses it - the component stack goes to the report.
 */
const AccountPreview = lazy(() =>
  import("account/preview").then((module) => ({ default: module.AccountPreview })),
);

const styles = stylex.create({
  title: {
    margin: 0,
    marginBottom: space.md,
    fontSize: text.xl,
    fontWeight: 650,
    letterSpacing: "-0.02em",
    color: colors.text,
  },
  lede: {
    margin: 0,
    marginBottom: space.xl,
    fontSize: text.lg,
    lineHeight: 1.6,
    color: colors.textMuted,
  },
  // What the preview's slot says while the module is on its way, and when it
  // never arrives. The wording is this page's: the account vertical is not
  // here yet to say anything.
  status: {
    margin: 0,
    marginBottom: space.xl,
    color: colors.textMuted,
  },
  // The one action on the page, so it looks like one.
  cta: {
    display: "inline-block",
    paddingBlock: space.md,
    paddingInline: space.xl,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    color: colors.accentText,
    fontWeight: 550,
    textDecoration: "none",
    opacity: { default: 1, ":hover": 0.9 },
  },
});

// Both at module scope, for the reason ../layout/AppErrorBoundary gives: an
// element built inside the component would be rebuilt on every render.
const previewLoading = (
  <p role="status" {...stylex.props(styles.status)}>
    Loading your account...
  </p>
);

const previewUnavailable = (
  <p role="alert" {...stylex.props(styles.status)}>
    Your account is unavailable right now.
  </p>
);

export function HomePage() {
  return (
    <>
      <h1 {...stylex.props(styles.title)}>Welcome</h1>

      <ErrorBoundary fallback={previewUnavailable}>
        <Suspense fallback={previewLoading}>
          <AccountPreview />
        </Suspense>
      </ErrorBoundary>

      <p {...stylex.props(styles.lede)}>
        A small account app, kept deliberately small so the tests around it can be the interesting
        part: one end-to-end journey through a real browser, integration tests per page, and unit
        tests for the pure helpers underneath.
      </p>

      <p>
        <Link to="/account" {...stylex.props(styles.cta)}>
          Go to your account
        </Link>
      </p>
    </>
  );
}
