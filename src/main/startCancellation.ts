export async function waitForStart<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation
  let onAbort!: () => void
  const cancelled = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) onAbort()
  })
  try {
    return await Promise.race([operation, cancelled])
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}
