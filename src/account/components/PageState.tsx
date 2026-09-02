import type { ReactNode } from "react";
import * as stylex from "@stylexjs/stylex";
import { colors, radius, space } from "../../tokens.stylex";

/**
 * The two things every page here says while it has nothing to show: that it is
 * loading, and that it failed.
 *
 * They live in ONE module because they are one decision - a page in this app
 * announces waiting as a `status` and failure as an `alert`, in these two
 * treatments, and a page that picked one of them from here and hand-rolled the
 * other would be exactly the drift this replaces.
 *
 * Neither owns a sentence. The wording belongs to the page - "Loading your
 * account..." is not what an activity list says - so it arrives as children and
 * the roles, the colours and the spacing arrive from here.
 */

const styles = stylex.create({
  status: {
    margin: 0,
    color: colors.textMuted,
  },
  error: {
    margin: 0,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
  },
});

/** What a page shows while it waits. `role="status"` announces it politely, so
 *  it does not interrupt whatever the visitor is already hearing. */
export function LoadingStatus({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p role="status" data-testid={testId} {...stylex.props(styles.status)}>
      {children}
    </p>
  );
}

/** What a page shows when something failed. `role="alert"` interrupts, which is
 *  the difference between the two: waiting can be missed, failure cannot. */
export function ErrorBanner({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p role="alert" data-testid={testId} {...stylex.props(styles.error)}>
      {children}
    </p>
  );
}
