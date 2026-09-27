export async function finishVariableShutdown(
  stop: () => unknown,
  flush: () => Promise<void>,
  report: (error: unknown) => void,
  timeoutMs = 2000
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const work = Promise.resolve()
    .then(stop)
    .catch(report)
    .then(flush)
    .catch(report)
    .then(() => true)
  try {
    return await Promise.race([
      work,
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs)
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}
