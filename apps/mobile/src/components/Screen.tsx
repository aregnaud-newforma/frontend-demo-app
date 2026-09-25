import type { ReactNode } from "react";
import { ScrollView } from "react-native";
import { StyleSheet } from "react-native-unistyles";

/**
 * The frame a screen's content sits in: the canvas colour, the padding, and
 * scrolling when the content is taller than the phone.
 *
 * The web's equivalent is the card in apps/shell/src/layout/RootLayout.tsx - a
 * bordered, shadowed surface centred in a 640px column. None of that crosses
 * over: a phone screen IS the column, and a card inset inside it is a border
 * drawn around the whole display for nothing. What survives is the padding and
 * the background, which is what the card was really doing.
 *
 * `contentInsetAdjustmentBehavior="automatic"` is what makes the content start
 * below a large title and slide under it on scroll, rather than being clipped
 * by the header - the native behaviour you would otherwise have to rebuild with
 * insets.
 */

const styles = StyleSheet.create((theme) => ({
  screen: {
    backgroundColor: theme.colors.canvas,
  },
  content: {
    padding: theme.space.xl,
    gap: theme.space.xl,
  },
}));

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
