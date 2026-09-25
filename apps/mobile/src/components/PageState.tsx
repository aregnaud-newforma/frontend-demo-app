import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

/**
 * The two things every screen here says while it has nothing to show: that it
 * is loading, and that it failed. The twin of the web's
 * apps/account/src/components/PageState.tsx, and one module for the same
 * reason - they are one decision, and a screen that took one from here and
 * hand-rolled the other would be exactly the drift this replaces.
 *
 * Neither owns a sentence; the wording arrives as children.
 *
 * What changes from the web is only the announcement. There are no ARIA roles
 * on native: `accessibilityLiveRegion="polite"` is what a `role="status"` does
 * on Android, `"assertive"` is the `role="alert"`, and `accessibilityRole` is
 * what VoiceOver reads on iOS. The distinction the web draws survives it -
 * waiting can be missed, failure cannot.
 */

const styles = StyleSheet.create((theme) => ({
  status: {
    color: theme.colors.textMuted,
    fontSize: theme.text.base,
  },
  error: {
    padding: theme.space.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dangerSoft,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.text.base,
  },
}));

export function LoadingStatus({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <Text
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      testID={testID}
      style={styles.status}
    >
      {children}
    </Text>
  );
}

export function ErrorBanner({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View accessibilityLiveRegion="assertive" testID={testID} style={styles.error}>
      <Text style={styles.errorText}>{children}</Text>
    </View>
  );
}
