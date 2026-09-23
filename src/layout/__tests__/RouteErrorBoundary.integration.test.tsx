/**
 * INTEGRATION TEST - ../RouteErrorBoundary, the screen a crashed ROUTE falls
 * back to.
 *
 * Separate from ./AppErrorBoundary.integration.test.tsx because the two catch
 * different errors and only one of them involves the router. A data router
 * intercepts what a route throws and renders its `errorElement` instead, so the
 * boundary outside <RouterProvider> never sees it - which makes "a page that
 * throws still shows our screen" a claim about the route TREE, not about a
 * component. Hence the real tree here, through @testing/render-route, with one
 * page replaced by one that throws.
 *
 * Mocking the page rather than adding a crashing route to ../../routes.tsx: a
 * test-only route would prove the boundary works on a route no visitor can
 * reach, while the app's own three kept whatever wiring they had.
 *
 * Nothing here asserts that Sentry was called, for the reason the sibling file
 * gives: the DSN is unset in tests, and stubbing `captureException` to watch it
 * be called would only prove that our effect calls the function we wrote it to
 * call.
 */
import { expect, it, vi } from "vitest";
import { renderRoute } from "@testing/render-route";

vi.mock("@home/HomePage", () => ({
  HomePage: () => {
    throw new Error("route exploded");
  },
}));

/*
 * Integration: route
 */

/** React re-throws a caught error to `window.onerror`; this is what swallows it. */
function silenceExpectedCrash(event: ErrorEvent) {
  event.preventDefault();
}

/** The setup function for this file. Apply AHA Testing principle */
async function renderCrashingRoute() {
  // Silenced so a PASSING run does not print a stack trace that reads like a
  // failure; the assertions below are what says the boundary worked.
  vi.spyOn(console, "error").mockImplementation(() => {});
  window.addEventListener("error", silenceExpectedCrash);

  const screen = await renderRoute("/");

  return {
    fallback: screen.getByRole("alert"),
    heading: screen.getByRole("heading", { name: "Something went wrong" }),
    retryButton: screen.getByRole("button", { name: "Try again" }),
    navigation: screen.getByRole("navigation", { name: "Main" }),
    stopSilencing: () => {
      window.removeEventListener("error", silenceExpectedCrash);
      vi.restoreAllMocks();
    },
  };
}

it("shows the crash screen when a route throws while rendering", async () => {
  const { fallback, heading, retryButton, stopSilencing } = await renderCrashingRoute();

  await expect.element(fallback).toBeVisible();
  await expect.element(heading).toBeVisible();
  await expect.element(retryButton).toBeVisible();

  stopSilencing();
});

it("keeps the navigation, so the crash is one page rather than the app", async () => {
  const { navigation, stopSilencing } = await renderCrashingRoute();

  await expect.element(navigation).toBeVisible();

  stopSilencing();
});
