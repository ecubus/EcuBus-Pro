/**
 * Connect-lifecycle state for the OrcaRouter provider panel.
 *
 * Kept out of the component so the async, cancel and back-forward-cache paths
 * can be tested directly. The panel is the only consumer.
 *
 * The rules this encodes:
 *  - every login attempt gets a new monotonic id, and every async response must
 *    still match it before it may touch state;
 *  - `pagehide` clears busy/hint **synchronously** and invalidates the attempt,
 *    because a restored page is not remounted and the invalidated request's
 *    `finally` block will (correctly) refuse to mutate state;
 *  - a real unmount cancels server-side work without writing UI state.
 *
 * @module orca/useOrcaConnect
 */

import { ref } from 'vue'

/** The subset of the preload bridge this composable needs. */
export interface ConnectBridge {
  connectStart(): Promise<{
    ok: boolean
    attemptId?: number
    authorizeUrl?: string
    port?: number
    error?: { message: string }
  }>
  connectAwait(
    attemptId: number
  ): Promise<{ ok: boolean; status?: unknown; error?: { message: string } }>
  connectCancel(attemptId?: number): Promise<unknown>
  /** Fire-and-forget cancel used from `pagehide`. */
  connectCancelKeepalive(): void
}

export interface ConnectLifecycleOptions {
  bridge: () => ConnectBridge | undefined
  /** Called with the adopted status when a login succeeds. */
  onStatus: (status: unknown) => void
  /** Called after a successful login, e.g. to reload the model catalog. */
  onConnected?: () => void | Promise<void>
  /** Called with a user-facing message when the attempt fails. */
  onError: (message: string) => void
  /** Called when the component is really unmounted. */
  onUnmounted?: () => void
}

export function useOrcaConnect(options: ConnectLifecycleOptions) {
  /** Monotonic attempt id. Bumped on start, cancel, pagehide and unmount. */
  let attempt = 0
  const busy = ref(false)
  const hint = ref('')
  const authorizeUrl = ref('')

  function isCurrent(id: number): boolean {
    return id === attempt
  }

  async function start(): Promise<void> {
    const bridge = options.bridge()
    if (!bridge) return
    const mine = ++attempt
    busy.value = true
    authorizeUrl.value = ''
    hint.value = 'waiting'
    try {
      const started = await bridge.connectStart()
      if (!isCurrent(mine)) return
      if (!started.ok) {
        options.onError(started.error?.message ?? 'connect failed')
        return
      }
      authorizeUrl.value = started.authorizeUrl ?? ''
      const result = await bridge.connectAwait(started.attemptId!)
      // A response belonging to a superseded attempt is discarded, so it can
      // never overwrite a newer login.
      if (!isCurrent(mine)) return
      if (!result.ok) {
        options.onError(result.error?.message ?? 'connect failed')
        return
      }
      options.onStatus(result.status)
      await options.onConnected?.()
    } catch (error) {
      if (isCurrent(mine)) {
        options.onError(error instanceof Error ? error.message : 'connect failed')
      }
    } finally {
      // Guarded: a stale attempt must not clear a newer attempt's busy state.
      // `pagehide` clears it synchronously instead.
      if (isCurrent(mine)) {
        busy.value = false
        hint.value = ''
      }
    }
  }

  /** Explicit cancel from the UI. */
  async function cancel(): Promise<void> {
    const bridge = options.bridge()
    if (!bridge) return
    attempt += 1
    busy.value = false
    hint.value = ''
    authorizeUrl.value = ''
    await bridge.connectCancel()
  }

  /**
   * Back-forward-cache safe cleanup.
   *
   * The page may be restored from the cache without a remount, so all UI state
   * is cleared here and now, and the server-side task is cancelled with a
   * fire-and-forget message that survives the page being frozen.
   */
  function handlePageHide(): void {
    if (!busy.value && !hint.value && !authorizeUrl.value) return
    attempt += 1
    busy.value = false
    hint.value = ''
    authorizeUrl.value = ''
    options.bridge()?.connectCancelKeepalive()
  }

  /** Real unmount: cancel server-side work, do not touch reactive state. */
  function handleUnmount(): void {
    attempt += 1
    options.bridge()?.connectCancelKeepalive()
    options.onUnmounted?.()
  }

  return {
    busy,
    hint,
    authorizeUrl,
    start,
    cancel,
    handlePageHide,
    handleUnmount,
    /** Test seam: the id the next attempt will claim. */
    currentAttempt: () => attempt
  }
}
