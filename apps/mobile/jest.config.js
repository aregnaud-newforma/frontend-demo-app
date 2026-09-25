const expoPreset = require("jest-expo/jest-preset");

/**
 * The mobile test tier.
 *
 * A second runner in a Vitest repository, and the reason is the runtime rather
 * than a preference: these tests render React Native components, which need
 * `jest-expo` to stand in for the native modules and to apply the Metro
 * transform. The CONTRACT the repository states is unchanged - the FILENAME
 * decides the tier - and `*.native.test.tsx` is this one, next to
 * `*.unit.test.ts` in Node and `*.integration.test.tsx` in a real Chromium.
 *
 * `testMatch` is narrowed to that suffix rather than left on jest-expo's
 * default (which also claims `*-test.ts` and anything under __tests__/): a file
 * that lands in the wrong tier by being saved in the wrong folder is exactly
 * what the naming rule exists to prevent.
 *
 * The preset is spread rather than named through `preset:` because both entries
 * below EXTEND it, and a key set beside a preset replaces that preset's key
 * whole rather than merging with it:
 *
 * - `transform` gains `.mjs`. The preset's babel entry matches `.[jt]sx?`, and
 *   @msw/data ships a single `.mjs` build - so without this the first import of
 *   the mock store fails on `Cannot use import statement outside a module`,
 *   pointing at a file the allowlist below already permits.
 * - `transformIgnorePatterns` is the preset's list plus the packages the mock
 *   network is built from. Jest does not transform node_modules by default, and
 *   MSW and its dependencies ship ESM.
 */
module.exports = {
  ...expoPreset,
  // APPENDED to the preset's own, never replacing them: jest-expo's setup files
  // are what define `__DEV__` and the React Native module mocks, and a bare
  // array here would drop them.
  setupFiles: [...(expoPreset.setupFiles ?? []), "<rootDir>/jest.setup-unistyles.js"],
  setupFilesAfterEnv: [...(expoPreset.setupFilesAfterEnv ?? []), "<rootDir>/jest.setup.ts"],
  testMatch: ["<rootDir>/src/**/*.native.test.tsx"],
  /*
   * The first test of each file pays for loading the app - expo-router, React
   * Native, the screens, the mock network - because the render is what first
   * requires them, and each module is run through babel on the way in. With
   * jest's transform cache warm that is 2.6s; cold, it is 25s on a laptop and
   * 30 to 45s on a CI runner, which always starts cold. The rest of each file
   * passes in milliseconds.
   *
   * So the limit is set for a cold cache with room to spare, not for the warm
   * one a laptop usually has. 30s was tried and failed one CI run in three. A
   * test that truly hangs is still caught, two minutes later.
   */
  testTimeout: 120_000,
  /*
   * `node` added to jest-expo's own `react-native` condition, and only for
   * that: MSW gates `msw/node` behind it in its exports map, so with the
   * preset's conditions alone the import fails with "Cannot find module
   * 'msw/node'" even though the file is right there. The tests run on Node -
   * that is the condition they are actually in - while the app itself resolves
   * through Metro and never reads this.
   */
  testEnvironmentOptions: {
    ...expoPreset.testEnvironmentOptions,
    customExportConditions: ["react-native", "node"],
  },
  transform: {
    ...expoPreset.transform,
    "\\.mjs$": expoPreset.transform["\\.[jt]sx?$"],
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|standard-navigation|use-latest-callback|nanoid|query-string|decode-uri-component|split-on-first|filter-obj|@unimodules/.*|unimodules|sentry-expo|@sentry/.*|native-base|react-native-svg|react-native-unistyles|react-native-nitro-modules|msw|@msw/.*|@mswjs/.*|@bundled-es-modules/.*|@open-draft/.*|until-async|rettime|outvariant|strict-event-emitter|headers-polyfill|is-node-process|tough-cookie|@faker-js/.*|fishery|enforce-unique)",
  ],
};
