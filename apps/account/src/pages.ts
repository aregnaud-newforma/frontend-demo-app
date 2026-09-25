// What this vertical exposes to the shell - the module behind `account/pages`
// in the shell's routes.tsx, named in ../vite.config.ts. The pages, and the
// stylesheet that dresses them: a remote is served from its own origin, so its
// CSS has to travel with it rather than sit in the shell's global.css.
import "./styles.css";

import { withProfiler } from "@sentry/react";
import { AccountPage as Account } from "./AccountPage";
import { EditAccountPage as EditAccount } from "./EditAccountPage";

/*
 * Each page goes to the shell through `withProfiler`, which adds a span for
 * the page's mount, and one for how long it stayed rendered, to whatever
 * navigation span is open. The browser SDK sees the remote's chunk load and the
 * requests the page makes, and nothing of React: without it a navigation says
 * how long the page took and not whether rendering was the reason.
 *
 * Here rather than in the shell's routes.tsx, because the shell says WHERE a
 * page lives and the remote says what it is. Here rather than in each page's
 * file, so the page the integration tests mount stays the plain component.
 *
 * `name` is written out because production code is minified: the default reads
 * the function's name, which by then is a letter. Without a Sentry client -
 * the tests, a local run with no DSN - the wrapper records nothing.
 */
export const AccountPage = withProfiler(Account, { name: "AccountPage" });
export const EditAccountPage = withProfiler(EditAccount, { name: "EditAccountPage" });
