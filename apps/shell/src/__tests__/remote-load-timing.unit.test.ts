/**
 * UNIT TEST - ../remote-load-timing: the federation runtime plugin.
 *
 * The runtime is not loaded: each `it` calls the two hooks in the order the
 * runtime does, with the arguments it passes, and reads what the plugin left
 * in the performance timeline - the one thing ../datadog.ts consumes.
 */
import { afterEach, describe, expect, it } from "vitest";
import remoteLoadTiming, { remoteLoadMeasure } from "../remote-load-timing";

// The shape `vite dev` passes: the runtime's own name, and the declared one.
const account = {
  name: "__mfe_internal__shell__mf_owner__187176579860030__account",
  alias: "account",
};

afterEach(() => {
  performance.clearMeasures(remoteLoadMeasure);
});

describe("remoteLoadTiming", () => {
  it("measures a remote from its request to its load, under the name its consumer declared", () => {
    // Arrange
    const plugin = remoteLoadTiming();
    const requestedAt = performance.now();

    // Act
    plugin.beforeRequest({ id: "account/pages" });
    plugin.afterLoadRemote({ id: "account/pages", remote: account, expose: "./pages" });

    // Assert
    const [load] = performance.getEntriesByName(remoteLoadMeasure);
    expect(load).toMatchObject({ detail: { remote: "account", expose: "./pages" } });
    expect(load?.startTime).toBeGreaterThanOrEqual(requestedAt);
  });

  it("measures nothing for a remote that failed to load", () => {
    // Arrange
    const plugin = remoteLoadTiming();

    // Act
    plugin.beforeRequest({ id: "account/pages" });
    plugin.afterLoadRemote({
      id: "account/pages",
      remote: account,
      expose: "./pages",
      error: new Error("remoteEntry.js 502"),
    });

    // Assert
    expect(performance.getEntriesByName(remoteLoadMeasure)).toEqual([]);
  });
});
