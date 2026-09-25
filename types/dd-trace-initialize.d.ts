/**
 * dd-trace's ESM entry point, which initialises the tracer and registers its
 * loader hook as a side effect of being imported. The package types its main
 * export and not this file, and `strict` makes the untyped import an error.
 *
 * Nothing is imported FROM it - server/Notifications/datadog.ts loads it for
 * the side effect alone - so the declaration is empty on purpose.
 */
declare module "dd-trace/initialize.mjs";
