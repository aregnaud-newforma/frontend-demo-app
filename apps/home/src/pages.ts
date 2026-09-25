// What this vertical exposes to the shell - the module behind `home/pages` in
// ../routes.tsx. See ../account/pages.ts for why the stylesheet is here too,
// and why the page is wrapped in `withProfiler`.
import "./styles.css";

import { withProfiler } from "@sentry/react";
import { HomePage as Home } from "./HomePage";

export const HomePage = withProfiler(Home, { name: "HomePage" });
