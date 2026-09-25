// What this vertical exposes to the shell - the module behind `account/pages`
// in the shell's routes.tsx, named in ../vite.config.ts. The pages, and the
// stylesheet that dresses them: a remote is served from its own origin, so its
// CSS has to travel with it rather than sit in the shell's global.css.
import "./styles.css";

export { AccountPage } from "./AccountPage";
export { EditAccountPage } from "./EditAccountPage";
