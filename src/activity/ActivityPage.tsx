import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { ActivityNote } from "./components/ActivityNote";
import { ActivityRow } from "./components/ActivityRow";
import { KindFilters } from "./components/KindFilters";
import { countByKind, newestFirst, toggleKind } from "./helpers/activity";
import { useActivity } from "./hooks/use-activity";
import type { ActivityKind } from "./helpers/kinds";
import type { ActivityQuery } from "./helpers/api";
import { colors, radius, shadow, space, text } from "../tokens.stylex";

/**
 * The unfiltered log, for the counts beside each filter control.
 *
 * At module scope so it is one value rather than one per render. It costs no
 * second request while nothing is filtered: this is the same question the list
 * is already asking, so both hooks resolve to one cache key and react-query
 * fetches once. Narrow the list and it becomes a second key — which is the
 * point, since the counts must go on describing the whole log.
 */
const WHOLE_LOG: ActivityQuery = { search: "", kinds: new Set<ActivityKind>() };

const styles = stylex.create({
  title: {
    margin: 0,
    marginBottom: space.xs,
    fontSize: text.xl,
    fontWeight: 650,
    letterSpacing: "-0.02em",
  },
  intro: {
    marginTop: 0,
    marginBottom: space.xl,
    color: colors.textMuted,
  },
  controls: {
    display: "flex",
    flexDirection: "column",
    gap: space.md,
    marginBottom: space.lg,
  },
  search: {
    width: "100%",
    paddingBlock: space.sm,
    paddingInline: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: { default: colors.border, ":focus": colors.accent },
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: text.family,
    fontSize: text.base,
    outline: "none",
    boxShadow: { default: null, ":focus": shadow.focus },
  },
  // One column, and no media query reaching for a second one: RootLayout caps
  // the shell at 640px, so a `1fr 20rem` split would have about 17rem for the
  // list at every viewport size and wrap every summary a word to a line. The
  // constraint is the container, which a viewport media query cannot see.
  layout: {
    display: "flex",
    flexDirection: "column",
    gap: space.xl,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: space.xs,
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  count: {
    margin: 0,
    marginBottom: space.sm,
    fontSize: text.sm,
    color: colors.textMuted,
  },
  // The list stays readable while the next answer is on its way, rather than
  // being replaced by a spinner on every keystroke.
  stale: {
    opacity: 0.6,
  },
  empty: {
    margin: 0,
    padding: space.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    color: colors.textMuted,
    textAlign: "center",
  },
  error: {
    margin: 0,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
  },
});

export function ActivityPage() {
  const [search, setSearch] = useState("");
  const [kinds, setKinds] = useState<ReadonlySet<ActivityKind>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Two questions asked side by side, not one after the other: neither hook
  // reads the other's result, so react-query starts both requests in the same
  // tick instead of stacking two round trips end to end.
  const log = useActivity({ search, kinds });
  const wholeLog = useActivity(WHOLE_LOG);

  if (log.isError) {
    return (
      <p role="alert" {...stylex.props(styles.error)}>
        Could not load your activity. Please try again.
      </p>
    );
  }

  // Everything below is computed while rendering, from the two queries and the
  // three pieces of state above. In particular `selected`: which entry the
  // panel shows is a LOOKUP in the list currently on screen, so an entry that a
  // filter just excluded takes its panel with it, with nothing to keep in step.
  const entries = newestFirst(log.data ?? []);
  const counts = countByKind(wholeLog.data ?? []);
  const total = wholeLog.data?.length ?? 0;
  const selected = entries.find((entry) => entry.id === selectedId);

  return (
    <>
      <h1 {...stylex.props(styles.title)}>Account activity</h1>
      <p {...stylex.props(styles.intro)}>
        Everything that has happened on your account. Pick an entry to leave yourself a note.
      </p>

      <div {...stylex.props(styles.controls)}>
        <input
          type="search"
          aria-label="Search activity"
          placeholder="Search activity"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          {...stylex.props(styles.search)}
        />
        <KindFilters
          selected={kinds}
          counts={counts}
          onToggle={(kind) => setKinds((current) => toggleKind(current, kind))}
        />
      </div>

      <div {...stylex.props(styles.layout)}>
        <div>
          <p {...stylex.props(styles.count)} role="status">
            {log.isPending
              ? "Loading your activity..."
              : `Showing ${entries.length} of ${total} entries`}
          </p>

          {entries.length === 0 && !log.isPending ? (
            <p {...stylex.props(styles.empty)}>Nothing here matches what you are looking for.</p>
          ) : (
            <ul {...stylex.props(styles.list, log.isPlaceholderData && styles.stale)}>
              {entries.map((entry) => (
                <li key={entry.id}>
                  <ActivityRow
                    id={entry.id}
                    kind={entry.kind}
                    at={entry.at}
                    summary={entry.summary}
                    device={entry.device}
                    hasNote={entry.note.trim() !== ""}
                    selected={entry.id === selectedId}
                    onSelect={setSelectedId}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/*
         * `key` is what resets the note. ActivityNote seeds its draft from the
         * entry it mounts with, so a different id remounts it with that entry's
         * note instead of leaving the previous one's text in the box — and it
         * happens in the same render as the heading above it changes.
         */}
        {selected && <ActivityNote key={selected.id} entry={selected} />}
      </div>
    </>
  );
}
