import { Link } from "@tanstack/react-router";

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
export function Navigation() {
  return (
    <nav aria-label="Main">
      <ul style={{ display: "flex", gap: "1rem", listStyle: "none", padding: 0 }}>
        <li>
          {/*
           * `exact` on both, because the active link is marked `aria-current="page"`
           * by the router and that attribute claims to BE the current page. Without
           * it "/" prefix-matches every route and would announce itself as current
           * everywhere, and "/account" would keep claiming the page on /account/edit.
           */}
          <Link to="/" activeOptions={{ exact: true }}>
            Home
          </Link>
        </li>
        <li>
          <Link to="/account" activeOptions={{ exact: true }}>
            Your account
          </Link>
        </li>
      </ul>
    </nav>
  );
}
