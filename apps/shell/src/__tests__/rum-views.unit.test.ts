/**
 * UNIT TEST - ../rum-views: when each Datadog RUM view starts.
 *
 * A real data router over a memory history, shaped like ../routes.tsx -
 * pathless layout and boundary routes, `lazy` pages standing in for the
 * remotes - so it goes through the states it does in the browser: a loading
 * phase while a page's module arrives, then the commit. Nothing renders; what
 * each `it` reads is the views the shell asked Datadog to start, and when.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { datadogRum } from "@datadog/browser-rum";
import { createMemoryRouter } from "react-router";
import { trackRumViews } from "../rum-views";

const page = { Component: () => null };

afterEach(() => {
  vi.restoreAllMocks();
});

/** The setup function for this file. Apply AHA Testing principle */
async function setup({
  loadAccount = () => Promise.resolve(page),
}: { loadAccount?: () => Promise<typeof page> } = {}) {
  const startView = vi.spyOn(datadogRum, "startView").mockImplementation(() => {});
  const router = createMemoryRouter([
    {
      Component: () => null,
      children: [
        {
          children: [
            { index: true, lazy: () => Promise.resolve(page) },
            { path: "account", lazy: loadAccount },
            { path: "account/edit", lazy: () => Promise.resolve(page) },
          ],
        },
      ],
    },
  ]);
  await vi.waitFor(() => expect(router.state.initialized).toBe(true));
  trackRumViews(router);
  return { router, startView };
}

describe("trackRumViews", () => {
  it("starts one view for the page the router opens on", async () => {
    // Act
    const { startView } = await setup();

    // Assert
    expect(startView).toHaveBeenCalledExactlyOnceWith({ name: "/", url: "/" });
  });

  it("starts the next page's view when the navigation begins, not when its URL commits", async () => {
    // Arrange
    const { router, startView } = await setup();
    startView.mockClear();

    // Act
    const navigation = router.navigate("/account/edit");
    const viewsBeforeCommit = startView.mock.calls.length;
    await navigation;

    // Assert
    expect(viewsBeforeCommit).toBe(1);
    expect(startView).toHaveBeenCalledExactlyOnceWith({
      name: "/account/edit",
      url: "/account/edit",
    });
  });

  it("starts it at the commit when the page is already loaded", async () => {
    // Arrange
    const { router, startView } = await setup();
    await router.navigate("/account");
    await router.navigate("/");
    startView.mockClear();

    // Act
    await router.navigate("/account");

    // Assert
    expect(startView).toHaveBeenCalledExactlyOnceWith({ name: "/account", url: "/account" });
  });

  it("starts a view for the page still on screen when its navigation is interrupted", async () => {
    // Arrange
    const { router, startView } = await setup({ loadAccount: () => new Promise(() => {}) });
    startView.mockClear();

    // Act
    void router.navigate("/account");
    await router.navigate("/");

    // Assert
    expect(startView.mock.calls).toEqual([
      [{ name: "/account", url: "/account" }],
      [{ name: "/", url: "/" }],
    ]);
  });

  it("starts no view for a query-string change on the same page", async () => {
    // Arrange
    const { router, startView } = await setup();
    startView.mockClear();

    // Act
    await router.navigate("/?tab=summary");

    // Assert
    expect(startView).not.toHaveBeenCalled();
  });
});
