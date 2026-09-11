/**
 * OrcaRouter connect flow — **Flow A, loopback redirect**.
 *
 * EcuBus-Pro is a desktop application: it always has a browser to open and its
 * main process can bind `127.0.0.1:0`, so the authorization code comes back
 * automatically and the user approves once. Flow B (out-of-band) would add a
 * manual copy/paste step for no benefit here, and Flow C (device grant) only
 * matters for a headless build. The project's existing `ecubuspro://` custom
 * protocol cannot be reused: OrcaRouter validates `callback_url` and accepts
 * only `https://…` or `http://localhost|127.0.0.1|[::1]`.
 *
 * Every terminal path releases the single-flight lock: success, denial,
 * exchange error, timeout, explicit cancel, and cancellation from the renderer
 * (including `pagehide`).
 *
 * @module orcarouter/pkceFlow
 */

import http from 'node:http'
import { AddressInfo } from 'node:net'
import axios from 'axios'
import { createAttempt, stateMatches } from './pkce'
import {
  OrcaOrigins,
  buildAuthorizeUrl,
  buildExchangeUrl,
  CONSOLE_AUTHORIZED_APPS_URL
} from './origins'
import { redactSecrets } from './credentials'

/** How long the user has to approve before the attempt is abandoned. */
export const CONNECT_TIMEOUT_MS = 300_000

/** Scope this client asks for. A wider grant may or may not be allowed. */
export const REQUESTED_SCOPE = 'api'

export const APP_NAME = 'EcuBus-Pro'

/** Raised when a connect attempt is cancelled by the user or the renderer. */
export class ConnectCancelledError extends Error {
  constructor(public readonly attemptId: number) {
    super('OrcaRouter sign-in was cancelled')
    this.name = 'ConnectCancelledError'
  }
}

/** Raised when the user declines on the consent screen. */
export class ConnectDeniedError extends Error {
  constructor() {
    super('OrcaRouter sign-in was declined on the consent screen')
    this.name = 'ConnectDeniedError'
  }
}

export class ConnectStateMismatchError extends Error {
  constructor() {
    super('OrcaRouter sign-in failed: the callback state did not match this attempt')
    this.name = 'ConnectStateMismatchError'
  }
}

export interface ConnectResult {
  key: string
  userId?: string
  /** Scope actually granted, read back from the response. */
  scope?: string
}

export interface ConnectHandle {
  /** Monotonic id for this attempt. Responses for older ids are ignored. */
  attemptId: number
  /** The URL the user must open. Shown in the UI so it can also be copied. */
  authorizeUrl: string
  /** Loopback port the code will be delivered to. */
  port: number
  /** Resolves once the code has been exchanged for a durable key. */
  result: Promise<ConnectResult>
}

interface ActiveAttempt {
  id: number
  server: http.Server
  state: string
  timer: NodeJS.Timeout
  cancel: (reason: Error) => void
}

/** Turn an exchange failure into an actionable, secret-free message. */
export function describeExchangeFailure(status: number | undefined, body: unknown): string {
  const detail =
    body && typeof body === 'object'
      ? redactSecrets(String((body as any).error_description ?? (body as any).error ?? ''))
      : redactSecrets(typeof body === 'string' ? body : '')
  const suffix = detail ? ` (${detail})` : ''
  switch (status) {
    case 400:
      return `OrcaRouter rejected the PKCE challenge method${suffix}. This is a client bug — use S256.`
    case 403:
      return `The authorization code was rejected: unknown, expired, already used, or it does not match this sign-in attempt${suffix}. Start the sign-in again.`
    case 429:
      return `Too many OrcaRouter sign-ins for this account in the last 24 hours${suffix}. Reuse the credential you already have, or try again later.`
    default:
      if (status === undefined) {
        return `Could not reach OrcaRouter to finish sign-in${suffix}. Check the network and try again.`
      }
      return `OrcaRouter sign-in failed with HTTP ${status}${suffix}`
  }
}

/**
 * Owns at most one in-flight loopback authorization. Starting a new attempt
 * always tears the previous one down first, so switching provider or auth
 * method can never leave a listener or the lock behind.
 */
export class PkceConnectService {
  private attemptCounter = 0
  private active: ActiveAttempt | null = null

  /** Id of the in-flight attempt, or `null` when idle. Used by the UI guard. */
  get activeAttemptId(): number | null {
    return this.active?.id ?? null
  }

  get isBusy(): boolean {
    return this.active !== null
  }

  /**
   * Bind the loopback listener, build the authorize URL and wait for the code.
   * The listener is opened *before* the URL is returned so the port is already
   * known and the browser cannot race it.
   */
  async start(origins: OrcaOrigins, openBrowser: (url: string) => void): Promise<ConnectHandle> {
    this.cancelActive()
    const attemptId = ++this.attemptCounter
    const { verifier, challenge, state } = createAttempt()

    const { server, port, codePromise } = await this.listen(attemptId, state)

    const authorizeUrl = buildAuthorizeUrl(origins.authBase, {
      callbackUrl: `http://127.0.0.1:${port}/cb`,
      codeChallenge: challenge,
      state,
      appName: APP_NAME,
      scope: REQUESTED_SCOPE
    })

    const result = this.complete(
      attemptId,
      server,
      codePromise,
      verifier,
      origins,
      openBrowser,
      authorizeUrl
    )

    return { attemptId, authorizeUrl, port, result }
  }

  /** Release the listener and mark the attempt cancelled. Safe to call twice. */
  cancel(attemptId?: number): boolean {
    const active = this.active
    if (!active) return false
    if (attemptId !== undefined && attemptId !== active.id) return false
    active.cancel(new ConnectCancelledError(active.id))
    return true
  }

  private cancelActive(): void {
    const active = this.active
    if (!active) return
    active.cancel(new ConnectCancelledError(active.id))
  }

  private listen(
    attemptId: number,
    state: string
  ): Promise<{ server: http.Server; port: number; codePromise: Promise<string> }> {
    return new Promise((resolve, reject) => {
      let settle: (code: string) => void
      let fail: (error: Error) => void
      const codePromise = new Promise<string>((res, rej) => {
        settle = res
        fail = rej
      })

      const server = http.createServer((req, res) => {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1')
        if (url.pathname !== '/cb') {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end('Not found')
          return
        }

        // Serve the closing page first so the user is never left on a blank tab.
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(
          '<!doctype html><meta charset="utf-8"><title>EcuBus-Pro</title>' +
            '<body style="font-family:sans-serif;padding:2rem">' +
            '<h2>OrcaRouter</h2><p>Connected. You can close this tab and return to EcuBus-Pro.</p>'
        )

        // Stop listening immediately: one callback per attempt, and the state
        // comparison happens before the code is used for anything.
        server.close()

        if (!stateMatches(state, url.searchParams.get('state'))) {
          fail(new ConnectStateMismatchError())
          return
        }
        const error = url.searchParams.get('error')
        if (error) {
          fail(
            error === 'access_denied' ? new ConnectDeniedError() : new Error(redactSecrets(error))
          )
          return
        }
        const code = url.searchParams.get('code')
        if (!code) {
          fail(new Error('OrcaRouter returned no authorization code'))
          return
        }
        settle(code)
      })

      server.on('error', (error) => {
        reject(new Error(`Could not open the OrcaRouter loopback listener: ${error.message}`))
      })

      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo
        this.active = {
          id: attemptId,
          server,
          state,
          timer: setTimeout(() => {
            this.cancel(attemptId)
          }, CONNECT_TIMEOUT_MS),
          cancel: (reason: Error) => {
            clearTimeout(this.active?.timer)
            this.active = null
            try {
              server.close()
            } catch {
              /* already closed */
            }
            fail(reason)
          }
        }
        resolve({ server, port: address.port, codePromise })
      })
    })
  }

  private async complete(
    attemptId: number,
    server: http.Server,
    codePromise: Promise<string>,
    verifier: string,
    origins: OrcaOrigins,
    openBrowser: (url: string) => void,
    authorizeUrl: string
  ): Promise<ConnectResult> {
    const releaseLock = (): void => {
      const active = this.active
      if (active && active.id === attemptId) {
        clearTimeout(active.timer)
        this.active = null
      }
      try {
        server.close()
      } catch {
        /* already closed */
      }
    }

    // The browser is opened only after the listener is live and only for the
    // attempt that still owns the lock.
    openBrowser(authorizeUrl)

    let code: string
    try {
      code = await codePromise
    } catch (error) {
      releaseLock()
      throw error
    }

    try {
      const response = await axios.post(
        buildExchangeUrl(origins.authBase),
        {
          code,
          code_verifier: verifier,
          code_challenge_method: 'S256'
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30_000,
          validateStatus: () => true
        }
      )

      if (response.status < 200 || response.status >= 300) {
        throw new Error(describeExchangeFailure(response.status, response.data))
      }

      const key = response.data?.key
      if (typeof key !== 'string' || key.length === 0) {
        throw new Error('OrcaRouter returned no key for this authorization code')
      }
      // Read the granted scope back; never assume the requested one was granted.
      const scope = typeof response.data?.scope === 'string' ? response.data.scope : undefined
      const userId =
        response.data?.user_id === undefined ? undefined : String(response.data.user_id)
      return { key, userId, scope }
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response) {
        throw new Error(describeExchangeFailure(undefined, error.message))
      }
      throw error
    } finally {
      // Whatever happened, this attempt no longer owns the lock. A late failure
      // can therefore never release a *newer* attempt.
      releaseLock()
    }
  }
}

/** Shown to the user next to the connect button. */
export function authorizedAppsUrl(): string {
  return CONSOLE_AUTHORIZED_APPS_URL
}
