import { expect, it, describe } from "vitest";
import { countByKind, knownKinds, newestFirst, toggleKind } from "../activity";
import { matchesKinds, matchesSearch } from "../filtering";
import type { ActivityEntry } from "../api";
import type { ActivityKind } from "../kinds";

const entry = (overrides: Partial<ActivityEntry> = {}): ActivityEntry => ({
  id: "1",
  kind: "sign-in",
  at: "2026-01-01T12:00:00.000Z",
  summary: "Signed in from a new device",
  device: "Chrome on macOS",
  note: "",
  ...overrides,
});

describe("newestFirst", () => {
  it("puts the most recent entry first", () => {
    const older = entry({ id: "older", at: "2025-12-01T08:00:00.000Z" });
    const newer = entry({ id: "newer", at: "2026-01-05T08:00:00.000Z" });

    expect(newestFirst([older, newer]).map(({ id }) => id)).toEqual(["newer", "older"]);
  });

  // The list it sorts is whatever the query cache is holding, and sorting that
  // in place would reorder it for every other reader with nothing to re-render.
  it("leaves the array it was given untouched", () => {
    const entries = [entry({ id: "a", at: "2025-01-01T00:00:00.000Z" }), entry({ id: "b" })];

    newestFirst(entries);

    expect(entries.map(({ id }) => id)).toEqual(["a", "b"]);
  });
});

describe("matchesSearch", () => {
  it("matches the summary and the device, ignoring case and surrounding space", () => {
    expect(matchesSearch(entry(), "  NEW DEVICE ")).toBe(true);
    expect(matchesSearch(entry(), "chrome")).toBe(true);
  });

  it("matches everything when the search is blank", () => {
    expect(matchesSearch(entry(), "   ")).toBe(true);
  });

  it("does not match an entry whose device is missing", () => {
    expect(matchesSearch(entry({ device: null }), "chrome")).toBe(false);
  });
});

describe("matchesKinds", () => {
  // An empty filter is "no filter", not "nothing". Getting this backwards would
  // show an empty log to anyone who has not ticked a box.
  it("matches every kind when nothing is selected", () => {
    expect(matchesKinds(entry(), new Set())).toBe(true);
  });

  it("keeps only the selected kinds", () => {
    expect(matchesKinds(entry({ kind: "security" }), new Set<ActivityKind>(["security"]))).toBe(
      true,
    );
    expect(matchesKinds(entry({ kind: "sign-in" }), new Set<ActivityKind>(["security"]))).toBe(
      false,
    );
  });
});

describe("toggleKind", () => {
  it("adds a kind that was off and removes one that was on", () => {
    const none = new Set<ActivityKind>();

    const one = toggleKind(none, "security");
    expect([...one]).toEqual(["security"]);

    expect([...toggleKind(one, "security")]).toEqual([]);
  });

  it("returns a new Set rather than mutating the one it was given", () => {
    const selected = new Set<ActivityKind>(["sign-in"]);

    const next = toggleKind(selected, "security");

    expect(next).not.toBe(selected);
    expect([...selected]).toEqual(["sign-in"]);
  });
});

describe("knownKinds", () => {
  it("drops a kind this app has never heard of", () => {
    const fromAUrl = new Set(["security", "telepathy"]) as Set<ActivityKind>;

    expect([...knownKinds(fromAUrl)]).toEqual(["security"]);
  });
});

describe("countByKind", () => {
  it("counts each kind, and reports zero for the ones with no entry", () => {
    const counts = countByKind([
      entry({ id: "a", kind: "sign-in" }),
      entry({ id: "b", kind: "sign-in" }),
      entry({ id: "c", kind: "security" }),
    ]);

    expect(counts).toEqual({ "sign-in": 2, "profile-change": 0, security: 1 });
  });
});
