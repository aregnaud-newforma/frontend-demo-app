import * as stylex from "@stylexjs/stylex";

/**
 * The design tokens every vertical styles with - one scale per thing that has a
 * scale, rather than a value invented at each call site.
 *
 * `defineVars` compiles to real CSS custom properties, so `colors.accent` is a
 * `var(--x123)` in the output and a typed import here. That is the difference
 * from a plain object of strings: a token can be REDEFINED for a subtree with
 * `stylex.createTheme`, and the dark-mode block below rebinds these same
 * variables at the media query, so nothing downstream has to know a theme
 * exists.
 *
 * The `.stylex.ts` suffix is required - it is how the compiler knows this file
 * defines variables, and how every importer resolves to the same ones instead
 * of a fresh set per module. It is required in the IMPORT SPECIFIER too, which
 * is why this package exports `./tokens.stylex` rather than `.`: the babel
 * plugin tests the specifier for that suffix before it resolves anything, so
 * `@demo/tokens` alone is not recognised as a variable-defining file.
 *
 * A package of its own rather than a file in a vertical: it belongs to no
 * feature, and every build - the shell and both remotes - has to compile the
 * same file to end up with the same CSS variables.
 *
 * ./tokens.native.ts is the same scale for React Native, and says why it is a
 * second file rather than a second consumer of this one. A value changed here
 * is a value to change there.
 */

const DARK = "@media (prefers-color-scheme: dark)";

export const colors = stylex.defineVars({
  // Surfaces, from the page backwards.
  canvas: { default: "#fbfbfd", [DARK]: "#111114" },
  surface: { default: "#ffffff", [DARK]: "#1a1a1f" },
  border: { default: "#e4e4e9", [DARK]: "#2e2e36" },

  // Text, in two weights of emphasis.
  text: { default: "#1c1c21", [DARK]: "#ececf1" },
  textMuted: { default: "#66666f", [DARK]: "#9a9aa5" },

  // One accent, used for links, focus and the primary action.
  accent: { default: "#3b4ce2", [DARK]: "#8f9bff" },
  accentText: { default: "#ffffff", [DARK]: "#111114" },
  accentSoft: { default: "#eef0ff", [DARK]: "#1e2140" },

  // Danger, for validation messages and failed requests.
  danger: { default: "#c02a3f", [DARK]: "#ff8095" },
  dangerSoft: { default: "#fdf0f2", [DARK]: "#2c1519" },
});

export const space = stylex.defineVars({
  xs: "0.25rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
  xxl: "2.5rem",
});

export const text = stylex.defineVars({
  family: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  sm: "0.8125rem",
  base: "0.9375rem",
  lg: "1.125rem",
  xl: "1.75rem",
});

export const radius = stylex.defineVars({
  sm: "6px",
  md: "10px",
  lg: "14px",
});

export const shadow = stylex.defineVars({
  card: {
    default: "0 1px 2px rgba(16, 16, 32, 0.06), 0 8px 24px rgba(16, 16, 32, 0.06)",
    [DARK]: "0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.35)",
  },
  focus: { default: "0 0 0 3px #c9cffa", [DARK]: "0 0 0 3px #33397a" },
});
