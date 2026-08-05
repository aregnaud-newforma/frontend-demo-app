import * as stylex from "@stylexjs/stylex";
import { Link } from "@tanstack/react-router";
import { colors, radius, space, text } from "../tokens.stylex";

/**
 * Where you can go in this app - the one list of destinations, rendered by the
 * shell so every route gets it.
 *
 * Its own component rather than markup inside RootLayout, even though RootLayout
 * is its only caller. That looks like the "page is a page, not a wrapper around
 * a component" rule in the README, but it is the other side of it: the layout's
 * job is the frame every route sits in, and the nav's job is the app's map. They
 * change for different reasons - a route added here, a landmark or a width
 * changed there - and only one of them needs to know the route tree exists.
 *
 * Same folder as RootLayout, because that shared reason to change is what a
 * folder is for: the chrome around the pages is one thing to work on, and both
 * halves of it are here. Not filed as generic UI either - it names concrete
 * routes, so it is owned by this app rather than reusable in another. Giving it
 * its destinations as props would make that honest, but it is an abstraction
 * built for one caller, which is what the README argues against.
 */
const styles = stylex.create({
  nav: {
    marginBottom: space.xl,
  },
  list: {
    display: "flex",
    gap: space.xs,
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  link: {
    display: "inline-block",
    paddingBlock: space.sm,
    paddingInline: space.md,
    borderRadius: radius.sm,
    fontSize: text.sm,
    fontWeight: 500,
    textDecoration: "none",
    color: { default: colors.textMuted, ":hover": colors.text },
    backgroundColor: { default: "transparent", ":hover": colors.accentSoft },
  },
  // The current page: same box, carrying the accent instead of borrowing it on
  // hover.
  linkCurrent: {
    color: colors.accent,
    backgroundColor: colors.accentSoft,
  },
});

/**
 * Active and inactive are two separate `stylex.props` calls handed to the
 * router, rather than one base class plus an "active" class layered on top.
 * That is StyleX's determinism rule taken seriously: merging inside a single
 * `props()` call is resolved by argument order, but two class names arriving on
 * the same element from different places are resolved by CSS source order,
 * which is the specificity guessing game StyleX exists to remove.
 */
const linkProps = stylex.props(styles.link);
const currentLinkProps = stylex.props(styles.link, styles.linkCurrent);

export function Navigation() {
  return (
    <nav aria-label="Main" {...stylex.props(styles.nav)}>
      <ul {...stylex.props(styles.list)}>
        <li>
          {/*
           * `exact` on both, because the active link is marked `aria-current="page"`
           * by the router and that attribute claims to BE the current page. Without
           * it "/" prefix-matches every route and would announce itself as current
           * everywhere, and "/account" would keep claiming the page on /account/edit.
           */}
          <Link
            to="/"
            activeOptions={{ exact: true }}
            activeProps={currentLinkProps}
            inactiveProps={linkProps}
          >
            Home
          </Link>
        </li>
        <li>
          <Link
            to="/account"
            activeOptions={{ exact: true }}
            activeProps={currentLinkProps}
            inactiveProps={linkProps}
          >
            Your account
          </Link>
        </li>
      </ul>
    </nav>
  );
}
