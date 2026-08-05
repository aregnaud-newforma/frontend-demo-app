import * as stylex from "@stylexjs/stylex";
import { Outlet } from "@tanstack/react-router";
import { Navigation } from "./Navigation";
import { colors, radius, shadow, space, text } from "../tokens.stylex";

/**
 * The shell every route renders inside: the site navigation, then the page in
 * the <Outlet>. The headings belong to the pages, not here - each route says
 * what it is, so the document outline changes when the route does.
 *
 * Where the routes GO is ./Navigation's business, not this file's. This one owns
 * the frame - the width, the landmarks, the order the two sit in - and stays
 * unaware that a route tree exists at all.
 */
const styles = stylex.create({
  shell: {
    maxWidth: 640,
    marginInline: "auto",
    // Room to breathe on a laptop, none wasted on a phone.
    paddingBlock: { default: space.xxl, "@media (max-width: 40rem)": space.lg },
    paddingInline: space.lg,
    fontFamily: text.family,
    fontSize: text.base,
    lineHeight: 1.55,
    color: colors.text,
  },
  main: {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    boxShadow: shadow.card,
    padding: { default: space.xxl, "@media (max-width: 40rem)": space.xl },
  },
});

export function RootLayout() {
  return (
    <div {...stylex.props(styles.shell)}>
      <Navigation />

      <main {...stylex.props(styles.main)}>
        <Outlet />
      </main>
    </div>
  );
}
