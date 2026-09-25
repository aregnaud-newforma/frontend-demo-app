import { StyleSheet } from "react-native-unistyles";
import { darkTheme, lightTheme } from "@demo/tokens/native";

/**
 * Unistyles, configured once before anything renders (./index.ts says why it is
 * imported first).
 *
 * The themes come straight from the tokens package rather than being declared
 * here, for the same reason the web's styles do: the palette belongs to the
 * design system, not to an app. @demo/tokens/native says why there are two
 * spellings of it.
 *
 * `adaptiveThemes` is the native equivalent of the web's
 * `prefers-color-scheme` media query - Unistyles swaps the theme when the OS
 * setting changes, and does it in C++ against the shadow tree, so nothing
 * re-renders to follow it. app.json sets `userInterfaceStyle: "automatic"`,
 * without which the OS never reports anything but light.
 *
 * One breakpoint, and it has to be there: Unistyles requires a `xs: 0` entry as
 * the base. The web's two media queries are about a window that can be any
 * width; a phone screen is not, and a second breakpoint here would be a rule
 * with nothing on the other side of it.
 */
const breakpoints = {
  xs: 0,
} as const;

const themes = {
  light: lightTheme,
  dark: darkTheme,
} as const;

type AppThemes = typeof themes;
type AppBreakpoints = typeof breakpoints;

// How `theme` and `mq` get their types inside every StyleSheet.create in the app.
declare module "react-native-unistyles" {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

StyleSheet.configure({
  settings: { adaptiveThemes: true },
  themes,
  breakpoints,
});
