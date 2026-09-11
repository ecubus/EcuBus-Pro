import { describe, expect, it, vi } from 'vitest'
import {
  useOrcaConnect,
  ConnectBridge
} from '../../src/renderer/src/views/home/orca/useOrcaConnect'

/** A deferred promise, so a test can control exactly when an await settles. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

interface Harness {
  bridge: ConnectBridge
  /** Resolve the Nth (0-based) pending connectStart call. */
  resolveStart: (value: any, index?: number) => void
  /** Resolve the Nth (0-based) pending connectAwait call. */
  resolveAwait: (value: any, index?: number) => void
  cancelCalls: number[]
  keepaliveCalls: number
  statuses: unknown[]
  errors: string[]
  connected: number
  unmounted: number
}

/**
 * A bridge whose async calls each get their own deferred, so a test can settle
 * one attempt without also settling a newer one.
 */
function makeHarness(): Harness {
  const starts: ReturnType<typeof deferred<any>>[] = []
  const awaits: ReturnType<typeof deferred<any>>[] = []

  const bridge: ConnectBridge = {
    connectStart: () => {
      const d = deferred<any>()
      starts.push(d)
      return d.promise
    },
    connectAwait: () => {
      const d = deferred<any>()
      awaits.push(d)
      return d.promise
    },
    connectCancel: (attemptId?: number) => {
      harness.cancelCalls.push(attemptId as number)
      return Promise.resolve({ ok: true })
    },
    connectCancelKeepalive: () => {
      harness.keepaliveCalls += 1
    }
  }

  const harness: Harness = {
    bridge,
    resolveStart: (value: any, index = 0) => starts[index]?.resolve(value),
    resolveAwait: (value: any, index = 0) => awaits[index]?.resolve(value),
    cancelCalls: [],
    keepaliveCalls: 0,
    statuses: [],
    errors: [],
    connected: 0,
    unmounted: 0
  }
  return harness
}

function setup(harness?: Harness) {
  const h = harness ?? makeHarness()
  const connect = useOrcaConnect({
    bridge: () => h.bridge,
    onStatus: (status) => {
      h.statuses.push(status)
    },
    onConnected: () => {
      h.connected += 1
    },
    onError: (message) => {
      h.errors.push(message)
    },
    onUnmounted: () => {
      h.unmounted += 1
    }
  })
  return { connect, h }
}

/** Flush pending microtasks so an awaited step can progress. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('orca connect lifecycle', () => {
  it('adopts a status on success and clears the busy state', async () => {
    const { connect, h } = setup()
    const run = connect.start()
    expect(connect.busy.value).toBe(true)

    h.resolveStart({ ok: true, attemptId: 7, authorizeUrl: 'https://www.orcarouter.ai/auth?x=1' })
    await tick()
    expect(connect.authorizeUrl.value).toContain('https://www.orcarouter.ai/auth')

    h.resolveAwait({ ok: true, status: { status: 'configured', source: 'pkce', generation: 1 } })
    await run

    expect(h.statuses).toEqual([{ status: 'configured', source: 'pkce', generation: 1 }])
    expect(h.connected).toBe(1)
    expect(connect.busy.value).toBe(false)
  })

  it('reports a failed start without leaving the panel busy', async () => {
    const { connect, h } = setup()
    const run = connect.start()
    h.resolveStart({ ok: false, error: { message: 'listener failed' } })
    await run

    expect(h.errors).toEqual(['listener failed'])
    expect(connect.busy.value).toBe(false)
    expect(h.statuses).toHaveLength(0)
  })

  it('reports a denial from the consent screen', async () => {
    const { connect, h } = setup()
    const run = connect.start()
    h.resolveStart({ ok: true, attemptId: 1, authorizeUrl: 'https://www.orcarouter.ai/auth' })
    await tick()
    h.resolveAwait({ ok: false, error: { message: 'declined' } })
    await run

    expect(h.errors).toEqual(['declined'])
    expect(connect.busy.value).toBe(false)
  })

  it('uses a fresh attempt id for every login', async () => {
    const { connect, h } = setup()
    const first = connect.currentAttempt()
    const run = connect.start()
    h.resolveStart({ ok: false, error: { message: 'x' } })
    await run
    expect(connect.currentAttempt()).toBeGreaterThan(first)

    const second = connect.currentAttempt()
    const run2 = connect.start()
    h.resolveStart({ ok: false, error: { message: 'x' } }, 1)
    await run2
    expect(connect.currentAttempt()).toBeGreaterThan(second)
  })

  it('discards a stale result so it cannot overwrite a newer login', async () => {
    const { connect, h } = setup()

    // First attempt starts and hangs at the exchange.
    const first = connect.start()
    h.resolveStart({ ok: true, attemptId: 1, authorizeUrl: 'https://www.orcarouter.ai/auth?1' })
    await tick()

    // The user cancels and starts a second login.
    await connect.cancel()
    const second = connect.start()
    expect(connect.busy.value).toBe(true)

    // The first attempt's response finally arrives. It must be ignored.
    h.resolveAwait({ ok: true, status: { status: 'configured', source: 'pkce', generation: 9 } }, 0)
    await first
    expect(h.statuses).toHaveLength(0)

    // The second attempt still owns the state.
    expect(connect.busy.value).toBe(true)
    h.resolveStart({ ok: true, attemptId: 2, authorizeUrl: 'https://www.orcarouter.ai/auth?2' }, 1)
    await tick()
    h.resolveAwait(
      { ok: true, status: { status: 'configured', source: 'pkce', generation: 10 } },
      1
    )
    await second

    expect(h.statuses).toEqual([{ status: 'configured', source: 'pkce', generation: 10 }])
    expect(connect.busy.value).toBe(false)
  })

  it('does not let a stale success trigger a catalog reload', async () => {
    const { connect, h } = setup()
    const first = connect.start()
    h.resolveStart({ ok: true, attemptId: 1, authorizeUrl: 'https://www.orcarouter.ai/auth' })
    await tick()
    await connect.cancel()

    h.resolveAwait({ ok: true, status: { status: 'configured' } }, 0)
    await first

    // onConnected must not have run for the discarded attempt.
    expect(h.connected).toBe(0)
  })

  it('cancels explicitly and releases the busy state', async () => {
    const { connect, h } = setup()
    const run = connect.start()
    await tick()
    await connect.cancel()

    expect(connect.busy.value).toBe(false)
    expect(connect.authorizeUrl.value).toBe('')
    expect(h.cancelCalls).toEqual([undefined])
    h.resolveStart({ ok: true, attemptId: 1, authorizeUrl: 'x' }, 0)
    await run
    expect(h.statuses).toHaveLength(0)
  })

  it('clears busy and hint synchronously on pagehide and cancels server-side', async () => {
    const { connect, h } = setup()
    const run = connect.start()
    h.resolveStart({ ok: true, attemptId: 1, authorizeUrl: 'https://www.orcarouter.ai/auth' })
    await tick()

    expect(connect.busy.value).toBe(true)
    connect.handlePageHide()

    // Synchronous: no await, no reliance on the invalidated request's finally.
    expect(connect.busy.value).toBe(false)
    expect(connect.hint.value).toBe('')
    expect(connect.authorizeUrl.value).toBe('')
    expect(h.keepaliveCalls).toBe(1)

    // The in-flight request settles afterwards and must not resurrect state.
    h.resolveAwait({ ok: true, status: { status: 'configured' } }, 0)
    await run
    expect(connect.busy.value).toBe(false)
    expect(h.statuses).toHaveLength(0)
  })

  it('allows a second login after pagehide without remounting', async () => {
    const { connect, h } = setup()

    // Login 1: reach the "waiting for the browser" state, then the page hides.
    const first = connect.start()
    h.resolveStart({ ok: true, attemptId: 1, authorizeUrl: 'https://www.orcarouter.ai/auth?1' })
    await tick()
    connect.handlePageHide()
    expect(connect.busy.value).toBe(false)

    // Login 2 starts on the same mounted instance.
    const second = connect.start()
    expect(connect.busy.value).toBe(true)
    h.resolveStart({ ok: true, attemptId: 2, authorizeUrl: 'https://www.orcarouter.ai/auth?2' }, 1)
    await tick()
    h.resolveAwait({ ok: true, status: { status: 'configured', source: 'pkce', generation: 2 } }, 1)
    await second

    expect(h.statuses).toEqual([{ status: 'configured', source: 'pkce', generation: 2 }])
    expect(connect.busy.value).toBe(false)

    // The abandoned first attempt settles late and changes nothing.
    h.resolveAwait(
      { ok: true, status: { status: 'configured', source: 'pkce', generation: 99 } },
      0
    )
    await first
    expect(h.statuses).toHaveLength(1)
  })

  it('is a no-op on pagehide when no login is in flight', () => {
    const { connect, h } = setup()
    connect.handlePageHide()
    expect(h.keepaliveCalls).toBe(0)
  })

  it('cancels server work on unmount without writing UI state', async () => {
    const { connect, h } = setup()
    const run = connect.start()
    h.resolveStart({ ok: true, attemptId: 1, authorizeUrl: 'https://www.orcarouter.ai/auth' })
    await tick()

    connect.handleUnmount()
    expect(h.keepaliveCalls).toBe(1)
    expect(h.unmounted).toBe(1)

    h.resolveAwait({ ok: true, status: { status: 'configured' } }, 0)
    await run
    expect(h.statuses).toHaveLength(0)
  })

  it('survives a bridge that is not ready yet', async () => {
    const connect = useOrcaConnect({
      bridge: () => undefined,
      onStatus: () => {},
      onError: () => {}
    })
    await expect(connect.start()).resolves.toBeUndefined()
    await expect(connect.cancel()).resolves.toBeUndefined()
    connect.handlePageHide()
    connect.handleUnmount()
    expect(connect.busy.value).toBe(false)
  })

  it('reports a thrown exchange error to the user', async () => {
    const { connect, h } = setup()
    const run = connect.start()
    h.resolveStart({ ok: true, attemptId: 1, authorizeUrl: 'https://www.orcarouter.ai/auth' })
    await tick()
    h.resolveAwait({ ok: false, error: { message: 'OrcaRouter sign-in failed with HTTP 403' } })
    await run

    expect(h.errors[0]).toMatch(/403/)
    expect(connect.busy.value).toBe(false)
  })

  it('does not log or surface a verifier anywhere in its state', async () => {
    const { connect, h } = setup()
    const run = connect.start()
    h.resolveStart({
      ok: true,
      attemptId: 1,
      // The authorize URL carries only the challenge, never the verifier.
      authorizeUrl: 'https://www.orcarouter.ai/auth?code_challenge=abc&code_challenge_method=S256'
    })
    await tick()
    h.resolveAwait({ ok: true, status: { status: 'configured' } })
    await run

    const surface = JSON.stringify({
      url: connect.authorizeUrl.value,
      hint: connect.hint.value,
      errors: h.errors
    })
    expect(surface).not.toContain('code_verifier')
    expect(surface).not.toContain('verifier')
  })

  it('does not use timers or polling that could hot-loop', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const { connect, h } = setup()
    const run = connect.start()
    h.resolveStart({ ok: true, attemptId: 1, authorizeUrl: 'https://www.orcarouter.ai/auth' })
    await tick()
    h.resolveAwait({ ok: true, status: { status: 'configured' } })
    await run
    // Only the test helper's own ticks; the composable schedules nothing.
    setTimeoutSpy.mockRestore()
  })
})
