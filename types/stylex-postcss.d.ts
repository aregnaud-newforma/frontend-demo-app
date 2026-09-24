/**
 * `@stylexjs/postcss-plugin` ships no type declarations of its own (it is plain
 * JS with no `types` entry in its package.json), and `strict` means an untyped
 * import is an error rather than a silent `any`.
 *
 * Declared here rather than reached around with a `@ts-expect-error`: the shape
 * below is the plugin's actual option contract, so a typo in `useCSSLayers` or
 * a forgotten `include` is caught where it is written.
 */
declare module "@stylexjs/postcss-plugin" {
  import type { PluginCreator } from "postcss";

  interface StyleXPostcssOptions {
    /**
     * Globs the plugin scans for `stylex.create` calls. Resolved against `cwd`
     * unless absolute - ../stylex.config.ts passes absolute ones, and says why.
     */
    include: Array<string>;
    /** What a relative `include` is resolved against. Defaults to process.cwd(). */
    cwd?: string;
    exclude?: Array<string>;
    /** Emit `@layer` rules so the generated CSS loses to authored CSS. */
    useCSSLayers?: boolean;
    /** Babel options the plugin re-parses the included files with. */
    babelConfig?: {
      plugins?: Array<unknown>;
      presets?: Array<unknown>;
      parserOpts?: { plugins?: Array<string> };
    };
  }

  const stylexPostcssPlugin: PluginCreator<StyleXPostcssOptions>;
  export default stylexPostcssPlugin;
}
