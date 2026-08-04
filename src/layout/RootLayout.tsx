import { Outlet } from "@tanstack/react-router";
import { Navigation } from "./Navigation";

/**
 * The shell every route renders inside: the site navigation, then the page in
 * the <Outlet>. The headings belong to the pages, not here - each route says
 * what it is, so the document outline changes when the route does.
 *
 * Where the routes GO is ./Navigation's business, not this file's. This one owns
 * the frame - the width, the landmarks, the order the two sit in - and stays
 * unaware that a route tree exists at all.
 */
export function RootLayout() {
  return (
    <div style={{ maxWidth: 640, margin: "3rem auto", fontFamily: "system-ui, sans-serif" }}>
      <Navigation />

      <main>
        <Outlet />
      </main>
    </div>
  );
}
