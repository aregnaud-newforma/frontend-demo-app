/**
 * Unistyles, before anything else in a test file exists.
 *
 * It is a Nitro native module: in Jest there is no C++ side to bind to, so this
 * mock substitutes one, and the config call right after gives that mock the
 * theme every `StyleSheet.create` in the app asks it for. Without the second
 * line the styles resolve against an undefined theme and every component
 * carrying one throws.
 *
 * A `setupFiles` entry rather than part of ./jest.setup.ts, and that split is
 * the whole reason this file exists: Jest runs `setupFiles` BEFORE the test
 * framework and before any module the setup imports, while babel hoists the
 * `import`s of a TypeScript setup file above any `require` in it - so "first"
 * cannot be expressed inside that file. Here it is Jest's ordering, not
 * babel's.
 */
require("react-native-unistyles/mocks");
require("./unistyles");
