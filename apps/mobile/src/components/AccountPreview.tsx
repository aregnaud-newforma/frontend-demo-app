import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useAccount } from "@demo/account-core/use-account";
import { ErrorBanner, LoadingStatus } from "./PageState";

/**
 * The account in one line - who it belongs to, and how to reach them - for the
 * home screen, which is not about the account but wants to show whose it is.
 *
 * On the web this component belongs to the account VERTICAL and the home
 * vertical fetches it over the wire, as `account/preview`, because the two are
 * separate deployments and the import is the cost of that (docs/adr/0003).
 * Here there is one build and one deployment, so it is one import and the
 * component lives beside the screen that uses it. That difference is the whole
 * of docs/adr/0007.
 *
 * The same query key as the account screen, so a visitor who switches tabs
 * finds the account already in the cache: the preview paid for the request, the
 * screen reads it.
 */

const styles = StyleSheet.create((theme) => ({
  preview: {
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentSoft,
  },
  text: {
    fontSize: theme.text.sm,
    color: theme.colors.textMuted,
  },
  name: {
    color: theme.colors.text,
    fontWeight: "600",
  },
}));

export function AccountPreview() {
  const { data: account, isPending, isError } = useAccount();

  if (isPending) return <LoadingStatus>Loading your account...</LoadingStatus>;
  if (isError) return <ErrorBanner>Could not load your account.</ErrorBanner>;

  return (
    <View testID="account-preview" style={styles.preview}>
      <Text style={styles.text}>
        Your account:{" "}
        <Text style={styles.name}>
          {account.prenom} {account.nom}
        </Text>{" "}
        ({account.email})
      </Text>
    </View>
  );
}
