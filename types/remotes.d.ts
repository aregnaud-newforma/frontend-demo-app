/**
 * What the shell's imports of a remote resolve to.
 *
 * `account/pages` is not a package and not a path: it is the name of a remote
 * plus a key it exposes (federation.config.ts, vite.account.config.ts), and at
 * runtime the federation plugin fetches it from the remote's own origin.
 * TypeScript knows nothing of that, so each exposed module is declared here as
 * a re-export of the source file behind it - the types are the source's own,
 * and a page renamed in the vertical fails to compile in the shell rather than
 * failing to load in the browser.
 *
 * Hand-written rather than generated: the plugin can emit `@mf-types/` from
 * each remote's build, but that is a generated directory to keep in sync, and
 * for one module per remote the declaration is shorter than the tooling. This
 * list and the `exposes` of each remote config are the pair to keep in step.
 *
 * The tests never go over the wire: vitest.config.ts aliases the same
 * specifiers straight to the source, so the route tree they mount is the one
 * the shell ships, minus the network.
 */
declare module "account/pages" {
  export * from "@account/pages";
}

declare module "account/preview" {
  export * from "@account/preview";
}

declare module "home/pages" {
  export * from "@home/pages";
}
