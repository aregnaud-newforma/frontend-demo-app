/** The User Timing name every remote load is measured under. */
export const remoteLoadMeasure = "remote.load";

/**
 * What the runtime tells `afterLoadRemote`, as much of it as is read here.
 * `alias` is the name the consumer declared - `account`, as in `account/pages`.
 * Neither `id` nor `name` is that: they are the runtime's own, and under
 * `vite dev` both arrive prefixed with an internal owner key.
 */
interface LoadedRemote {
  id: string;
  remote?: { name: string; alias?: string };
  expose?: string;
  error?: unknown;
}

/**
 * How long each remote took to arrive, from the moment a route or a `lazy`
 * asked for it to the moment its module was ready: the remote's
 * `remoteEntry.js` and the chunk behind the key, the cost docs/adr/0003 accepts
 * for deploying the verticals apart. Inside a view's loading time it cannot be
 * told apart from the page's own work; here it is one number per remote.
 *
 * A Module Federation runtime plugin rather than a timer at each `import()`,
 * so a remote added to the route tree is measured without anyone remembering
 * to. Registered in EVERY build (../../../vite.base.ts, `runtimePlugins`),
 * because each build runs its own federation instance with its own plugins:
 * the home remote fetches `account/preview` through its instance, not the
 * shell's.
 *
 * It writes a `performance.measure` and knows nothing of Datadog. ./datadog.ts
 * turns each measure into a duration vital; the browser's performance panel
 * shows the same entries with no SDK at all. Importing the SDK here instead
 * would give this module its own copy, loaded before the shared one is
 * negotiated, and never initialised.
 *
 * Only a load that succeeded is measured: one that failed has no load time,
 * and the route's error boundary already reports it.
 *
 * A default export because the runtime imports the plugin that way and calls
 * it to build the plugin.
 */
export default function remoteLoadTiming() {
  const startedAt = new Map<string, number>();

  return {
    name: "remote-load-timing",
    beforeRequest<Args extends { id: string }>(args: Args) {
      startedAt.set(args.id, performance.now());
      return args;
    },
    afterLoadRemote({ id, remote, expose, error }: LoadedRemote) {
      const start = startedAt.get(id);
      startedAt.delete(id);
      if (start === undefined || error !== undefined || !remote || !expose) return;

      performance.measure(remoteLoadMeasure, {
        start,
        detail: { remote: remote.alias ?? remote.name, expose },
      });
    },
  };
}
