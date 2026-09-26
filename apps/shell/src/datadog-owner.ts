/**
 * What each build's Datadog plugin stamped into its chunks (`sourceCodeContext`
 * in ../../../vite.base.ts): an `Error().stack` taken inside the chunk, whose
 * top frame is the chunk's URL, mapped to the build's service and version.
 */
type SourceCodeContext = { service?: string; version?: string };

declare global {
  interface Window {
    DD_SOURCE_CODE_CONTEXT?: Record<string, SourceCodeContext>;
  }
}

export type Owner = { service: string; version?: string };

/** The script URL of each frame, newest first - Chrome's `at f (url:1:2)` and Firefox's `f@url:1:2` alike. */
const frameUrls = (stack: string) =>
  stack.split("\n").flatMap((line) => {
    const url = /(https?:\/\/[^\s()]+?):\d+:\d+/.exec(line)?.[1];
    return url ? [url] : [];
  });

/**
 * Which remote a fetch or XHR belongs to, read off the stack it was sent from.
 *
 * The SDK attributes these itself, but by the stack's TOP frame only, and on
 * this page that frame is never the caller: Sentry wraps `fetch` and `XMLHttpRequest`
 * over Datadog's own wrapper, so the frame just above Datadog is Sentry's, in
 * a chunk of the shell. Every request would be the shell's. This reads the
 * same stamps past it, down to the first frame a remote's chunk owns - the
 * account's API client, say, under the shell's wrappers and above the shell's
 * TanStack Query that called it.
 *
 * Returns nothing when no remote frame is on the stack - a request the shell
 * made, Sentry's own envelopes - and nothing leaves the event under the
 * shell's service.
 *
 * Pure, and its own module, so it can be unit-tested with stack strings and no
 * SDK: ./datadog.ts is where it is wired in, from `beforeSend`, which is where
 * the stack is still attached to the event.
 */
export function ownerOfStack(
  stack: string,
  stamps: Record<string, SourceCodeContext>,
  shellService: string,
): Owner | undefined {
  const byUrl = new Map<string, SourceCodeContext>();
  for (const [stampStack, context] of Object.entries(stamps)) {
    const [url] = frameUrls(stampStack);
    if (url && !byUrl.has(url)) byUrl.set(url, context);
  }

  for (const url of frameUrls(stack)) {
    const { service, version } = byUrl.get(url) ?? {};
    if (service && service !== shellService) return { service, version };
  }
  return undefined;
}
