import { apiBaseUrl } from "./api-base-url";
import { parseFrenchPhone } from "./phone";
import type { AccountValues, Language, ValidAccount } from "./validation";

/** The account as the server stores and returns it. */
export interface Account {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  langue: Language;
  bio: string;
}

/** The account as it goes back over the wire (the server owns the id). */
export type AccountPayload = Omit<Account, "id">;

/**
 * Server shape -> form shape, for the GET.
 */
export function toValues(account: Account): AccountValues {
  const parsed = account.telephone ? parseFrenchPhone(account.telephone) : null;
  return {
    nom: account.nom,
    prenom: account.prenom,
    email: account.email,
    telephone: parsed?.valid ? parsed.national : "",
    langue: account.langue,
    bio: account.bio,
  };
}

/**
 * Form shape -> wire shape, for the PUT: normalize the phone to E.164.
 */
export function toPayload(values: ValidAccount): AccountPayload {
  const parsed = parseFrenchPhone(values.telephone);
  return {
    nom: values.nom,
    prenom: values.prenom,
    email: values.email,
    telephone: parsed.valid ? parsed.e164 : null,
    langue: values.langue,
    bio: values.bio,
  };
}

/**
 * Single network boundary, both directions. The absolute URL is built per call
 * rather than held as a constant, because the origin it is built against
 * differs per host and per run - ./api-base-url.ts says which.
 */
function accountUrl() {
  return new URL("/api/account", apiBaseUrl());
}

export async function getAccount(): Promise<Account> {
  const response = await fetch(accountUrl());

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as Account;
}

export async function updateAccount(values: ValidAccount): Promise<Account> {
  const response = await fetch(accountUrl(), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toPayload(values)),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as Account;
}
