import { router } from "expo-router";
import { Pressable, Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { AccountPreview } from "../components/AccountPreview";
import { Screen } from "../components/Screen";

/**
 * The landing screen - the twin of apps/home/src/HomePage.tsx.
 *
 * No data of its own: the welcome reads the same whoever opens it, so this
 * screen runs no query and has no loading or error branch. The one thing on it
 * that varies - whose account this is - it borrows from <AccountPreview/>.
 *
 * The web wraps that preview in a Suspense boundary and an ErrorBoundary,
 * because there the component arrives over the network from another deployment
 * and can fail to load at all. Here it is in the same bundle: it cannot fail to
 * arrive, only to fetch, and the fetch failure is the ErrorBanner the component
 * renders itself.
 */

const styles = StyleSheet.create((theme) => ({
  title: {
    fontSize: theme.text.xl,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: theme.colors.text,
  },
  lede: {
    fontSize: theme.text.lg,
    lineHeight: theme.text.lg * 1.5,
    color: theme.colors.textMuted,
  },
  cta: {
    alignSelf: "flex-start",
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.xl,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaLabel: {
    color: theme.colors.accentText,
    fontWeight: "600",
    fontSize: theme.text.base,
  },
}));

export default function HomeScreen() {
  return (
    <Screen>
      {/* No <Stack.Screen> and no header: this tab is a single screen with
          nowhere to go back to, so the heading is the content's, the way the
          web's pages own their <h1>. The account tab is the one that needs a
          stack, because it pushes. */}
      <Text style={styles.title}>Welcome</Text>

      <AccountPreview />

      <Text style={styles.lede}>
        A small account app, kept deliberately small so the tests around it can be the interesting
        part: one end-to-end journey through a real browser, integration tests per page, and unit
        tests for the pure helpers underneath.
      </Text>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.navigate("/account")}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
      >
        <Text style={styles.ctaLabel}>Go to your account</Text>
      </Pressable>
    </Screen>
  );
}
