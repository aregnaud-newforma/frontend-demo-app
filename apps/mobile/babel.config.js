/**
 * The Metro transform, and the one plugin this app cannot do without.
 *
 * Unistyles is not a runtime hook: the plugin rewrites every component that
 * reads a stylesheet so its native shadow node can be bound to the style, which
 * is what lets a theme change update the view without a React render. Styles
 * outside `root` are compiled but never made reactive - they would simply stop
 * following the OS theme, with nothing to see at build time - so `root` has to
 * name the directory the components actually live in.
 *
 * The plugin disables itself when NODE_ENV is `test`; apps/mobile/jest.setup.ts
 * is where the mocks take over.
 */
module.exports = function (api) {
  api.cache(true);

  return {
    presets: ["babel-preset-expo"],
    plugins: [["react-native-unistyles/plugin", { root: "src" }]],
  };
};
