/**
 * Pure helpers for SWIG std::vector-like objects ({ size(), get(i) }).
 * Kept free of the native module so unit tests can run without a built `cmsis_dap.node`.
 */

export function stringVectorToPathArray(v: { size(): number; get(i: number): string }): string[] {
  const n = v.size()
  const out: string[] = new Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = v.get(i)
  }
  return out
}

export function u8VectorToBuffer(v: { size(): number; get(i: number): number }): Buffer {
  const n = v.size()
  const out = Buffer.allocUnsafe(n)
  for (let i = 0; i < n; i++) {
    out[i] = v.get(i) & 0xff
  }
  return out
}
