import * as Sentry from "@sentry/react-native";
import { Link, Stack } from "expo-router";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { toValues, type Account } from "@demo/account-core/api";
import { LANGUAGE_LABELS } from "@demo/account-core/validation";
import { useAccount } from "@demo/account-core/use-account";
import { ErrorBanner, LoadingStatus } from "../../components/PageState";
import { Screen } from "../../components/Screen";
import { SummaryRow } from "../../components/SummaryRow";

/**
 * The account, read-only - the twin of apps/account/src/AccountPage.tsx, field
 * for field and branch for branch: the same three states (failed, still
 * loading, loaded), the same six rows, and the same "Not provided" at the call
 * site rather than as a prop on SummaryRow.
 *
 * `toValues` is what turns the stored E.164 phone into the national form a
 * person reads, and it is imported rather than reimplemented - that helper, the
 * query key above it and the schema the form validates with are the whole
 * reason packages/account-core exists.
 */

const styles = StyleSheet.create((theme) => ({
  summary: {
    gap: theme.space.lg,
  },
  editLink: {
    alignSelf: "flex-start",
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.accent,
    fontWeight: "600",
    fontSize: theme.text.sm,
    overflow: "hidden",
  },
}));

function AccountScreen() {
  const { data: account, isError: loadFailed } = useAccount();

  return (
    <Screen>
      <Stack.Screen options={{ title: "Your account" }} />

      {loadFailed ? (
        <ErrorBanner testID="account-error">
          Could not load your account. Please try again.
        </ErrorBanner>
      ) : !account ? (
        <LoadingStatus testID="account-loading">Loading your account...</LoadingStatus>
      ) : (
        <AccountSummary account={account} />
      )}
    </Screen>
  );
}

// A mount span per visit - ../../sentry.ts says why.
export default Sentry.withProfiler(AccountScreen);

function AccountSummary({ account }: { account: Account }) {
  const values = toValues(account);

  return (
    <>
      <View accessibilityLabel="Account summary" testID="account-summary" style={styles.summary}>
        <SummaryRow term="Name">{account.nom}</SummaryRow>
        <SummaryRow term="First name">{account.prenom}</SummaryRow>
        <SummaryRow term="Email">{account.email}</SummaryRow>
        {/* The empty wording stays at the call site rather than becoming a
            `fallback` prop: only two of the six fields are optional, and an
            option nobody sets reads as a feature the component has. */}
        <SummaryRow term="Phone">{values.telephone || "Not provided"}</SummaryRow>
        <SummaryRow term="Language">{LANGUAGE_LABELS[account.langue]}</SummaryRow>
        <SummaryRow term="Bio">{account.bio || "Not provided"}</SummaryRow>
      </View>

      <Link href="/account/edit" testID="edit-account-link" style={styles.editLink}>
        Edit your account
      </Link>
    </>
  );
}
