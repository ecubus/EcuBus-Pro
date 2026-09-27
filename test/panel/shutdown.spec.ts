import { afterEach, expect, it, vi } from 'vitest'
import { finishVariableShutdown } from '../../src/main/var/shutdown'

afterEach(() => vi.useRealTimers())

it('still flushes after synchronous cleanup throws', async () => {
  const error = new Error('cleanup failed')
  const report = vi.fn()
  const flush = vi.fn().mockResolvedValue(undefined)
  expect(
    await finishVariableShutdown(
      () => {
        throw error
      },
      flush,
      report
    )
  ).toBe(true)
  expect(flush).toHaveBeenCalledOnce()
  expect(report).toHaveBeenCalledWith(error)
})

it.each(['stop', 'flush'])('bounds a pending %s without waiting forever', async (phase) => {
  vi.useFakeTimers()
  const never = () => new Promise<void>(() => {})
  const complete = async () => {}
  const pending = finishVariableShutdown(
    phase === 'stop' ? never : complete,
    phase === 'flush' ? never : complete,
    vi.fn()
  )
  await vi.advanceTimersByTimeAsync(2000)
  expect(await pending).toBe(false)
})

it('reports rejected writes and clears the timeout after completion', async () => {
  vi.useFakeTimers()
  const report = vi.fn()
  expect(
    await finishVariableShutdown(
      () => {},
      async () => {
        throw new Error('disk failed')
      },
      report
    )
  ).toBe(true)
  expect(report).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})
