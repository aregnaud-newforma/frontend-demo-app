/**
 * UNIT TEST - ../sentry-owner: ownerOf.
 *
 * One `it` per way an event can be attributed: to the build that threw, to
 * nobody, and to the deepest build when several are on the stack. Event
 * literals in the shape the SDK produces, since the function reads exactly
 * that; no SDK is loaded.
 */
import { describe, expect, it } from "vitest";
import type { Event, StackFrame } from "@sentry/react";
import { ownerOf } from "../sentry-owner";

const ACCOUNT = { dsn: "https://key@o1.ingest.sentry.io/account", release: "abc123" };
const HOME = { dsn: "https://key@o1.ingest.sentry.io/home", release: "abc123" };

/** An event whose one exception has these frames, oldest first. */
const eventWith = (frames: StackFrame[]): Event => ({
  exception: { values: [{ type: "Error", value: "boom", stacktrace: { frames } }] },
});

describe("ownerOf", () => {
  it("routes an error to the build whose frame raised it", () => {
    const event = eventWith([
      { filename: "http://shell/assets/index.js", function: "RouterProvider" },
      {
        filename: "http://account/assets/preview.js",
        function: "AccountPreview",
        module_metadata: ACCOUNT,
      },
    ]);

    expect(ownerOf(event)).toEqual([ACCOUNT]);
  });

  it("picks the deepest stamped frame when several builds are on the stack", () => {
    // The home page rendered the account's preview, which threw: the account
    // team's, not the home team's.
    const event = eventWith([
      { filename: "http://home/assets/pages.js", function: "HomePage", module_metadata: HOME },
      {
        filename: "http://account/assets/preview.js",
        function: "AccountPreview",
        module_metadata: ACCOUNT,
      },
    ]);

    expect(ownerOf(event)).toEqual([ACCOUNT]);
  });

  it("leaves an error nobody stamped to the default project", () => {
    const event = eventWith([
      { filename: "chrome-extension://abc/content.js", function: "inject" },
      { filename: "http://shell/assets/index.js", function: "render" },
    ]);

    expect(ownerOf(event)).toEqual([]);
  });

  it("treats a build stamped without a DSN as unstamped", () => {
    // The plugin ran, but that remote's DSN was not set: the stamp carries a
    // release and nothing to send to.
    const event = eventWith([
      {
        filename: "http://home/assets/pages.js",
        module_metadata: { dsn: undefined, release: "abc123" },
      },
    ]);

    expect(ownerOf(event)).toEqual([]);
  });

  it("has no owner for an event with no exception", () => {
    expect(ownerOf({ message: "just a message" })).toEqual([]);
  });
});
