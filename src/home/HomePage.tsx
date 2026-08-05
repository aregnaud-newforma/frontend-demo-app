import * as stylex from "@stylexjs/stylex";
import { Link } from "@tanstack/react-router";
import { colors, radius, space, text } from "../tokens.stylex";

/**
 * The landing route. "/" used to forward straight to the summary; it now holds
 * a page of its own, so the redirect is gone from ../routes.
 *
 * No data of its own on purpose: the welcome reads the same whoever opens it,
 * so this page runs no query and has no loading or error branch. That absence
 * is why it needs so much less testing than the two account pages - there is
 * nothing here that can be in the wrong state.
 */
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

export function HomePage() {
  return (
    <>
      <h1 {...stylex.props(styles.title)}>Welcome</h1>

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
