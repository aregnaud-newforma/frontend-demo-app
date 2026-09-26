import type { ComponentType } from "react";
import { UNSTABLE_ReactComponentTracker as ReactComponentTracker } from "@datadog/browser-rum-react";

/**
 * A component whose every commit Datadog times, under `name`: each one becomes
 * a `reactComponentRender` vital on the RUM view, with the name as its
 * description and the render, layout-effect and effect phases in its context.
 * That is what puts a React component - not a file, not a URL - on the view's
 * waterfall next to the request it waited for.
 *
 * It times RENDERING, and nothing of the wait before it: a component that
 * suspends on its data is timed on the commit that finally shows it, so the
 * account request is the fetch on the waterfall and not part of this number.
 * And it times the commits that reach the tracker: a re-render started by
 * state inside the component leaves the tracker alone, and is not measured.
 *
 * Applied where ./pages.ts applies Sentry's `withProfiler`, and for the same
 * reasons: the remote says what its components are, and the tests mount the
 * plain component. `name` is written out because production code is minified.
 *
 * The shell's `datadogRum.init` is what sends the vitals, reaching this remote
 * through the singleton federation.config.ts shares. Before it - and without
 * it, in the tests or a local run with no Datadog variables - each commit is
 * queued rather than sent.
 *
 * `UNSTABLE_` is the SDK's word: the export can change in a minor release.
 */
export function withRenderTracking<Props extends object>(
  Component: ComponentType<Props>,
  name: string,
) {
  function Tracked(props: Props) {
    return (
      <ReactComponentTracker name={name}>
        <Component {...props} />
      </ReactComponentTracker>
    );
  }
  return Tracked;
}
