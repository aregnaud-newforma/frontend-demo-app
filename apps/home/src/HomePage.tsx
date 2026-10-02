import { lazy, Suspense, useEffect, useEffectEvent, useRef, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { datadogRum } from "@datadog/browser-rum";
import { addReactError } from "@datadog/browser-rum-react";
import { ErrorBoundary } from "@sentry/react";
import { Link } from "react-router";
import { colors, radius, space, text } from "@demo/tokens/tokens.stylex";
import { CitySearch } from "./city-search/CitySearch";

/**
 * The landing route. "/" used to forward straight to the summary; it now holds
 * a page of its own, so the redirect is gone from ../routes.
 *
 * No data of its own: the welcome reads the same whoever opens it, so this
 * page runs no query. The one thing on it that varies - whose account this is
 * - it borrows, and the only loading and error states here are that slot's.
 */

/**
 * The account's preview, from the account vertical: a component from ANOTHER
 * remote, reached the way the shell reaches this page - over the wire, by
 * `<remote>/<key>` (../vite.config.ts says this build consumes `account`).
 * Not `@account/components/AccountPreview`: that would bundle the account's
 * query and API shape into THIS build, and the two verticals would then have to
 * deploy together for a change to either to be safe.
 *
 * `lazy` because a federated module arrives asynchronously, and `Suspense` is
 * how a component tree waits for one - for the module, and then for the
 * account, since the preview suspends on its query too. The boundary under it
 * is the cost of consuming another deployment, made visible: if the account
 * remote is down, or the account cannot be loaded, only the preview goes, the
 * welcome still renders. Sentry's ErrorBoundary
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
  // What the preview's slot says while the module or the account is on its
  // way, and when either never arrives. The wording is this page's: the
  // preview leaves both states to whoever embeds it.
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

// Datadog's view of the same crash, which the boundary would otherwise keep
// from it - apps/shell/src/layout/AppErrorBoundary.tsx does the same.
const reportToDatadog = (error: unknown, componentStack: string) =>
  addReactError(error, { componentStack });

const previewUnavailable = (
  <p role="alert" {...stylex.props(styles.status)}>
    Your account is unavailable right now.
  </p>
);

/**
 * "The visitor saw whose account this is" as a Datadog RUM operation: started
 * when the page mounts, a success when the preview is on screen with its data,
 * a failure when the boundary catches the module or the account failing, and
 * abandoned when the visitor leaves before either. Datadog pairs the start and
 * the stop by name and key, and counts the success rate an SLO can be set on.
 *
 * Not the load time of the module - ../../shell/src/remote-load-timing.ts
 * measures that, as a vital. This is the journey the visitor cares about, of
 * which the module is one leg and the account request another.
 *
 * Abandonment is reported on the next tick rather than in the cleanup itself,
 * because StrictMode runs every effect twice in development: a cleanup and a
 * setup straight after it, on the same mount. The second setup cancels the
 * pending abandonment and keeps the operation it started; a real unmount has
 * no second setup, and the abandonment goes out.
 *
 * Nothing is sent before `datadogRum.init` and nothing after a stop: the SDK
 * drops a stop with no start, and the ref keeps a second stop from being sent.
 */
const previewOperation = "account.preview_displayed";

function usePreviewOperation() {
  // One key per visit, so a visit's stop cannot close the operation another
  // visit started.
  const [operationKey] = useState(() => crypto.randomUUID());
  const stopped = useRef(false);
  const pendingAbandon = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(
    function trackPreviewOperation() {
      if (pendingAbandon.current === undefined) {
        datadogRum.startOperation(previewOperation, { operationKey });
      } else {
        clearTimeout(pendingAbandon.current);
      }
      return () => {
        pendingAbandon.current = setTimeout(() => {
          if (stopped.current) return;
          stopped.current = true;
          datadogRum.failOperation(previewOperation, "abandoned", { operationKey });
        });
      };
    },
    [operationKey],
  );

  function stop(report: () => void) {
    if (stopped.current) return;
    stopped.current = true;
    report();
  }

  return {
    succeed: () => stop(() => datadogRum.succeedOperation(previewOperation, { operationKey })),
    fail: () => stop(() => datadogRum.failOperation(previewOperation, "error", { operationKey })),
  };
}

/**
 * Renders nothing, and mounts in the same commit as the preview: a Suspense
 * reveals everything under it at once, so this effect runs when the preview -
 * module and account both - is on screen.
 */
function OnRevealed({ onRevealed }: { onRevealed: () => void }) {
  const revealed = useEffectEvent(onRevealed);
  useEffect(() => revealed(), []);
  return null;
}

export function HomePage() {
  const operation = usePreviewOperation();

  return (
    <>
      <h1 {...stylex.props(styles.title)}>Welcome</h1>

      <ErrorBoundary
        fallback={previewUnavailable}
        onError={(error, componentStack) => {
          reportToDatadog(error, componentStack);
          operation.fail();
        }}
      >
        <Suspense fallback={previewLoading}>
          <AccountPreview />
          <OnRevealed onRevealed={operation.succeed} />
        </Suspense>
      </ErrorBoundary>

      <CitySearch />

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
