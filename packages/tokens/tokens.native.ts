/**
 * The same design tokens as ./tokens.stylex.ts, spelled for React Native.
 *
 * Written twice on purpose, and the duplication is the boundary - the same
 * argument docs/adr/0004 makes about the C# record and the TypeScript interface
 * that describe one payload. StyleX's `defineVars` compiles to CSS custom
 * properties, which is a thing only a browser has: there is no build that could
 * turn `var(--x123)` into something a native view understands, and a runtime
 * bridge that tried would put a lookup on every style in the app. So the values
 * live in one package, in two files, side by side, and a colour changed in one
 * is a colour to change in the other.
 *
 * Two differences follow from the platform rather than from taste:
 *
 * - Every measurement is a NUMBER, in density-independent pixels. React Native
 *   has no `rem`, so the web's scale is multiplied by its 16px root here -
 *   `space.md` is `0.75rem` there and `12` here, which is the same size.
 * - The theme is not a media query. StyleX rebinds its variables inside
 *   `prefers-color-scheme: dark` and nothing downstream knows; on native the
 *   two palettes are two objects, and Unistyles swaps between them
 *   (apps/mobile/unistyles.ts sets `adaptiveThemes`).
 *
 * `shadow.focus` has no twin: a focus ring is a pointer affordance, and the
 * native controls signal focus with their border colour instead.
 */

/** The web's scale times its 16px root. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 40,
} as const;

export const text = {
  sm: 13,
  base: 15,
  lg: 18,
  xl: 28,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
} as const;

const lightColors = {
  canvas: "#fbfbfd",
  surface: "#ffffff",
  border: "#e4e4e9",

  text: "#1c1c21",
  textMuted: "#66666f",

  accent: "#3b4ce2",
  accentText: "#ffffff",
  accentSoft: "#eef0ff",

  danger: "#c02a3f",
  dangerSoft: "#fdf0f2",
} as const;

const darkColors = {
  canvas: "#111114",
  surface: "#1a1a1f",
  border: "#2e2e36",

  text: "#ececf1",
  textMuted: "#9a9aa5",

  accent: "#8f9bff",
  accentText: "#111114",
  accentSoft: "#1e2140",

  danger: "#ff8095",
  dangerSoft: "#2c1519",
} as const;

/**
 * The card shadow as React Native takes it: iOS reads the four `shadow*`
 * props, Android reads `elevation` alone. The web's two-layer shadow collapses
 * to one here, because that is all either platform draws.
 */
const lightShadow = {
  card: {
    shadowColor: "#101020",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
} as const;

const darkShadow = {
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 3,
  },
} as const;

export const lightTheme = {
  colors: lightColors,
  space,
  text,
  radius,
  shadow: lightShadow,
} as const;

export const darkTheme = {
  colors: darkColors,
  space,
  text,
  radius,
  shadow: darkShadow,
} as const;

/** Both palettes carry the same keys, so a style written against one fits the other. */
export type AppTheme = typeof lightTheme;
