/**
 * INTEGRATION TEST - ../AppErrorBoundary, the screen a crash falls back to.
 *
 * A real browser rather than a unit test, because the claim is about React's
 * error boundary mechanism - `componentDidCatch` firing on a render that threw -
 * and not about a function's return value. The thing worth proving is that the
 * user gets SOMETHING, since the alternative this exists to prevent is a blank
 * document with the error only in the console.
 *
 * Rendered on its own rather than through @testing/render-route: the boundary
 * sits outside the router in main.tsx precisely so it survives a router that
 * does not, so mounting it inside one would test the opposite arrangement.
 *
 * Nothing here asserts that Sentry was called. The DSN is unset in tests (see
 * ../../sentry.ts), so the SDK has nothing to send - and a test that stubbed
 * `captureException` to watch it be called would only prove that the Sentry
 * component calls Sentry's own function, which is their test, not ours.
 */
import { expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { AppErrorBoundary } from "../AppErrorBoundary";

/*
 * Integration: component
 */

/** React re-throws a caught error to `window.onerror`; this is what swallows it. */
function silenceExpectedCrash(event: ErrorEvent) {
  event.preventDefault();
}

/** The setup function for this file. Apply AHA Testing principle */
async function renderCrashing({ crash }: { crash: boolean }) {
  function Crashing() {
    if (crash) throw new Error("render exploded");

    return <p>The app rendered fine</p>;
  }

  // React re-throws the caught error to `window.onerror` and logs it, both by
  // design. Silenced so a PASSING run does not print a stack trace that reads
  // like a failure; the assertions below are what says the boundary worked.
  vi.spyOn(console, "error").mockImplementation(() => {});
  window.addEventListener("error", silenceExpectedCrash);

  const screen = await render(
    <AppErrorBoundary>
      <Crashing />
    </AppErrorBoundary>,
  );

  return {
    fallback: screen.getByRole("alert"),
    heading: screen.getByRole("heading", { name: "Something went wrong" }),
    retryButton: screen.getByRole("button", { name: "Try again" }),
    content: screen.getByText("The app rendered fine"),
    stopSilencing: () => {
      window.removeEventListener("error", silenceExpectedCrash);
      vi.restoreAllMocks();
    },
  };
}

// Use case: Any page crashing — Sad path

it("shows the fallback instead of a blank page when a child throws", async () => {
  const { fallback, heading, retryButton, stopSilencing } = await renderCrashing({ crash: true });

  await expect.element(fallback).toBeVisible();
  await expect.element(heading).toBeVisible();
  // Offered, not decorative: without it the only way out of the fallback is a
  // manual reload.
  await expect.element(retryButton).toBeVisible();

  stopSilencing();
});

// Use case: Any page crashing — Happy path

it("renders its children untouched when nothing throws", async () => {
  const { content, stopSilencing } = await renderCrashing({ crash: false });

  await expect.element(content).toBeVisible();

  stopSilencing();
});
