type SignalValue = { value: unknown; rawValue: unknown }
const values = new Map<string, SignalValue>()

export function recordSignalValues(batch: Record<string, unknown>) {
  for (const [key, samples] of Object.entries(batch)) {
    if (!/^(can|lin)\..+\.signals\./.test(key) || !Array.isArray(samples)) continue
    const value = samples.at(-1)?.[1]
    if (value && typeof value === 'object') values.set(key, value)
  }
}

export function currentSignalValue(key: string) {
  return values.get(key)
}

export function clearSignalValues() {
  values.clear()
}

export function signalValueSnapshot() {
  return Object.fromEntries(values)
}

export function restoreSignalSnapshot(snapshot: Record<string, SignalValue>) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (!values.has(key)) values.set(key, value)
  }
}
