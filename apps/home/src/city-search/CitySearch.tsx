import { lazy, Suspense, useEffect, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { colors, radius, space, text } from "@demo/tokens/tokens.stylex";
import { searchCities, type City } from "./cities";

// Only fetched once there is something to list.
const CityList = lazy(() => import("./CityList").then((module) => ({ default: module.CityList })));

const styles = stylex.create({
  section: {
    marginBottom: space.xl,
  },
  label: {
    display: "block",
    marginBottom: space.sm,
    fontWeight: 550,
    color: colors.text,
  },
  input: {
    width: "100%",
    maxWidth: "24rem",
    padding: space.sm,
    marginBottom: space.md,
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    fontSize: text.base,
  },
  status: {
    margin: 0,
    color: colors.textMuted,
  },
});

/** Two letters is the shortest name the API matches on usefully. */
const MIN_QUERY_LENGTH = 2;

export function CitySearch() {
  const [query, setQuery] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [sortedCities, setSortedCities] = useState<City[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setCities([]);
      return;
    }
    searchCities(query.trim())
      .then((result) => {
        setCities(result);
        setError(false);
      })
      .catch(() => setError(true));
  }, [query]);

  // Largest first: a search for "Saint" should open on the towns people mean.
  useEffect(() => {
    setSortedCities([...cities].sort((a, b) => b.population - a.population));
  }, [cities]);

  return (
    <section {...stylex.props(styles.section)}>
      <label htmlFor="city-search" {...stylex.props(styles.label)}>
        Find a city
      </label>
      <input
        id="city-search"
        type="search"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        {...stylex.props(styles.input)}
      />
      {error ? (
        <p role="alert" {...stylex.props(styles.status)}>
          City search is unavailable right now.
        </p>
      ) : sortedCities.length > 0 ? (
        <Suspense fallback={null}>
          <CityList cities={sortedCities} />
        </Suspense>
      ) : null}
    </section>
  );
}
