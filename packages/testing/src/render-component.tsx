import { render } from "vitest-browser-react";
import { AppProviders } from "./app-providers";
import type { AppUnderTest } from "./app-under-test";

/**
 * Mounts ONE component under the app's providers - the Integration component
 * level, beside ./render-route's Integration page level. A file's import says
 * which of the two it is written at.
 *
 * The component is passed as an element rather than as a type-and-props pair,
 * so its own props are type-checked at the call site and a wrapper the markup
 * needs (a <dl> around a <dt>/<dd> row, a <form> around a field) can be written
 * around it in the same expression.
 *
 * No router: a component more than one page mounts has a contract of its own -
 * its props in, its callbacks out - and it is that contract this level proves.
 * A component that only ever renders inside one page is a step in that page's
 * journey and belongs in the page's file.
 */
export async function renderComponent(ui: React.ReactElement, app: AppUnderTest) {
  return await render(<AppProviders app={app}>{ui}</AppProviders>);
}
