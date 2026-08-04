import { Link } from "@tanstack/react-router";
import { toValues } from "./helpers/api";
import { useAccount } from "./hooks/use-account";
import { LANGUAGE_LABELS } from "./helpers/validation";

export function AccountPage() {
  const { data: account, isError: loadFailed } = useAccount();

  if (loadFailed) {
    return <p role="alert">Could not load your account. Please try again.</p>;
  }

  if (!account) {
    return <p role="status">Loading your account...</p>;
  }

  const values = toValues(account);

  return (
    <>
      <h1>Your account</h1>

      <dl aria-label="Account summary">
        <dt>Name</dt>
        <dd>{account.nom}</dd>

        <dt>First name</dt>
        <dd>{account.prenom}</dd>

        <dt>Email</dt>
        <dd>{account.email}</dd>

        <dt>Phone</dt>
        <dd>{values.telephone || "Not provided"}</dd>

        <dt>Language</dt>
        <dd>{LANGUAGE_LABELS[account.langue]}</dd>

        <dt>Bio</dt>
        <dd>{account.bio || "Not provided"}</dd>
      </dl>

      <Link to="/account/edit">Edit your account</Link>
    </>
  );
}
