import * as stylex from "@stylexjs/stylex";
import { useAccount } from "@demo/account-core/use-account";
import { ErrorBanner, LoadingStatus } from "./PageState";
import { colors, radius, space, text } from "@demo/tokens/tokens.stylex";

/**
 * The account in one line - who it belongs to, and how to reach them - for a
 * page that is not about the account but wants to show whose it is. The
 * welcome (src/home/HomePage.tsx) embeds it.
 *
 * It lives here and not in home/ because everything in it is this vertical's:
 * the query, the field names, what "the account" looks like when it is still
 * loading or could not be loaded. Home gets a component and knows nothing of
 * the API behind it - it reaches this through `account/preview`, the remote,
 * and would break with the account's deployment rather than with its code.
 *
 * The same query key as the summary page, so a visitor who follows the link
 * finds the account already in the cache: the preview paid for the request,
 * the page reads it.
 */
const styles = stylex.create({
  preview: {
    margin: 0,
    marginBottom: space.xl,
    paddingBlock: space.md,
    paddingInline: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    fontSize: text.sm,
    color: colors.textMuted,
  },
  name: {
    color: colors.text,
    fontWeight: 600,
  },
});

export function AccountPreview() {
  const { data: account, isPending, isError } = useAccount();

  if (isPending) return <LoadingStatus>Loading your account...</LoadingStatus>;
  if (isError) return <ErrorBanner>Could not load your account.</ErrorBanner>;

  return (
    <p data-testid="account-preview" {...stylex.props(styles.preview)}>
      Your account:{" "}
      <span {...stylex.props(styles.name)}>
        {account.prenom} {account.nom}
      </span>{" "}
      ({account.email})
    </p>
  );
}
