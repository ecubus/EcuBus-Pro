/**
 * Ambient module declarations for **non-TypeScript assets** imported from worker-side code
 * (native addons, raw HTML templates, etc.).
 *
 * @remarks
 * Webpack / electron-vite resolve these import specifiers at build time; the declarations keep `tsc` happy
 * when worker sources use `?raw` or `.node` suffixes.
 *
 * @module worker/node-shims
 */

/** Native Node addon (`.node`) — actual exports are untyped here. */
declare module '*.node' {
  const _: any
  export default _
}

/** Raw string import (Vite-style `?raw` query). */
declare module '*.html?raw' {
  const content: string
  export default content
}
