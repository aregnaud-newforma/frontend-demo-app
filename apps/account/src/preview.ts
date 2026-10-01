// What this vertical exposes to OTHER verticals - the module behind
// `account/preview`, which the home vertical embeds in its welcome. Its own
// module rather than an extra export of ./pages.ts, so a consumer that wants
// the preview does not also pull the pages' chunk, and so what this vertical
// offers beyond its routes is one short list.
import "./styles.css";

import { AccountPreview as Preview } from "./components/AccountPreview";
import { withRenderTracking } from "./helpers/with-render-tracking";

// Timed in Datadog as the home page renders it - ./helpers/with-render-tracking.tsx.
export const AccountPreview = withRenderTracking(Preview, "AccountPreview");
