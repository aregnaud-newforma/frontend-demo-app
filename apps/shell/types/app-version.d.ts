/**
 * The build's version - the commit, or `SENTRY_RELEASE` in CI - which
 * ../vite.config.ts's `define` writes into the bundle in place of this name
 * (../../../vite.base.ts's `appVersion` says where it comes from). Undefined
 * under Vitest, which takes no vite.config.ts: read it only where the tests
 * never reach, the way ../src/datadog.ts does after its `test` check.
 */
declare const APP_VERSION: string;
