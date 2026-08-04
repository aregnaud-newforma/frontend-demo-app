import { Link } from "@tanstack/react-router";

/**
 * The landing route. "/" used to forward straight to the summary; it now holds
 * a page of its own, so the redirect is gone from ../routes.
 *
 * No data of its own on purpose: the welcome reads the same whoever opens it,
 * so this page runs no query and has no loading or error branch. That absence
 * is why it needs so much less testing than the two account pages - there is
 * nothing here that can be in the wrong state.
 */
export function HomePage() {
  return (
    <>
      <h1>Welcome</h1>

      <p>
        A small account app, kept deliberately small so the tests around it can be the interesting
        part: one end-to-end journey through a real browser, integration tests per page, and unit
        tests for the pure helpers underneath.
      </p>

      <p>
        <Link to="/account">Go to your account</Link>
      </p>
    </>
  );
}
