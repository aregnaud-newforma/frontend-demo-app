import type { Event } from "@sentry/react";

/**
 * Which Sentry project an error belongs to, read off its stack.
 *
 * The app is three builds (docs/adr/0003), and an error is owned by whichever
 * one threw it: a crash inside the account's preview is the account team's,
 * however it was reached. The stack is what says so. Each build's Sentry
 * plugin stamps its bundles with the DSN and release of that build's project
 * (`moduleMetadata` in ../vite.base.ts), `moduleMetadataIntegration` copies
 * the stamp onto every frame that came from such a bundle, and this reads
 * the stamps back.
 *
 * The frame that decides is the DEEPEST stamped one - the last in the array,
 * since Sentry lists frames oldest first - because that is closest to where
 * the error was raised. A shell frame further up (the router calling the
 * page) says only who asked, not who failed.
 *
 * Returns nothing for an event with no stamped frame - a build without the
 * plugin, an error thrown by a browser extension - and nothing means the
 * default DSN, the shell's. Every event has an owner; not every one can be
 * attributed.
 *
 * Pure, and its own module, so it can be unit-tested with an event literal
 * and no SDK: ../sentry.ts is where it is wired in, from `beforeSend`, which
 * is the one place the stamps are still on the event.
 */
export type Owner = { dsn: string; release: string };

export function ownerOf(event: Event): Owner[] {
  const frames = event.exception?.values?.flatMap((value) => value.stacktrace?.frames ?? []) ?? [];

  const stamped = frames.findLast((frame) => typeof frame.module_metadata?.dsn === "string");
  if (!stamped) return [];

  const { dsn, release } = stamped.module_metadata as { dsn: string; release?: string };
  return [{ dsn, release: release ?? "" }];
}
