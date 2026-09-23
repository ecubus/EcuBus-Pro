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

/** Asset path import (electron-vite `?asset` query) — resolves to a file path string. */
declare module '*?asset' {
  const path: string
  export default path
}

/** Asset path import unpacked from the asar archive (`?asset&asarUnpack`) — resolves to a file path string. */
declare module '*?asset&asarUnpack' {
  const path: string
  export default path
}
