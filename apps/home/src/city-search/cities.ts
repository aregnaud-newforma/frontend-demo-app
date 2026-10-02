/**
 * The French government's geography API: every commune and every department,
 * public, no key, CORS open. https://geo.api.gouv.fr/decoupage-administratif
 */
const GEO_API = "https://geo.api.gouv.fr";

interface Commune {
  nom: string;
  code: string;
  codeDepartement: string;
  codesPostaux: string[];
  population?: number;
}

interface Departement {
  nom: string;
  code: string;
}

/** A commune as the search shows it: its department named rather than numbered. */
export interface City {
  code: string;
  name: string;
  postcode: string;
  department: string;
  population: number;
}

async function getJson<T>(url: URL): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function searchCities(query: string): Promise<City[]> {
  const communesUrl = new URL("/communes", GEO_API);
  communesUrl.search = new URLSearchParams({
    nom: query,
    fields: "nom,code,codeDepartement,codesPostaux,population",
    boost: "population",
    limit: "10",
  }).toString();

  // The department list does not depend on the query, so both go out at once.
  const [communes, departements] = await Promise.all([
    getJson<Commune[]>(communesUrl),
    getJson<Departement[]>(new URL("/departements", GEO_API)),
  ]);

  const departementNames = new Map(departements.map((d) => [d.code, d.nom]));
  return communes.map((commune) => ({
    code: commune.code,
    name: commune.nom,
    postcode: commune.codesPostaux[0] ?? "",
    department: departementNames.get(commune.codeDepartement) ?? commune.codeDepartement,
    population: commune.population ?? 0,
  }));
}
