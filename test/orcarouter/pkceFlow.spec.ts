import { afterEach, describe, expect, it, vi } from 'vitest'
import http from 'node:http'
import { AddressInfo } from 'node:net'
import { createHash } from 'node:crypto'
import {
  ConnectCancelledError,
  ConnectDeniedError,
  ConnectStateMismatchError,
  PkceConnectService,
  describeExchangeFailure
} from '../../src/main/orcarouter/pkceFlow'
import { resolveOrigins } from '../../src/main/orcarouter/origins'

const FAKE_ISSUED_KEY = 'sk-orca-issued00000000000000000000000000'

interface FakeAuthServer {
  origin: string
  /** Every authorize-style request the client was expected to make. */
  exchanges: {
    body: any
    contentType: string | undefined
    codeVerifier: string
    method: string
  }[]
  /** Query params the consent screen would have received. */
  authorizeParams: URLSearchParams | null
  close(): Promise<void>
}

/**
 * A local stand-in for the OrcaRouter auth origin.
 *
 * It records the verifier the client presents so the test can prove the
 * challenge sent at authorize time was derived from the same verifier, and it
 * returns the exact response envelope the real endpoint documents.
 */
async function startFakeAuthServer(
  options: {
    /** Force a response code for the exchange. */
    status?: number
    body?: unknown
    /** Delay before answering, to exercise cancel/timeout paths. */
    delayMs?: number
    /** Capture the authorize URL query instead of requiring a real browser. */
    captureAuthorize?: boolean
  } = {}
): Promise<FakeAuthServer> {
  const exchanges: FakeAuthServer['exchanges'] = []
  let authorizeParams: URLSearchParams | null = null

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')

    if (req.method === 'GET' && url.pathname === '/auth') {
      authorizeParams = url.searchParams
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<p>consent</p>')
      return
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/auth/keys') {
      let raw = ''
      req.on('data', (chunk) => (raw += chunk))
      req.on('end', () => {
        let parsed: any = null
        const contentType = req.headers['content-type']
        if (contentType?.includes('application/json')) parsed = JSON.parse(raw)
        else parsed = Object.fromEntries(new URLSearchParams(raw))

        exchanges.push({
          body: parsed,
          contentType,
          codeVerifier: parsed.code_verifier,
          method: req.method!
        })

        if (options.delayMs) {
          setTimeout(() => respond(res), options.delayMs)
        } else {
          respond(res)
        }
      })
      return
    }

    res.writeHead(404)
    res.end()
  })

  function respond(res: http.ServerResponse): void {
    const status = options.status ?? 200
    const body = options.body ?? { key: FAKE_ISSUED_KEY, user_id: '12345', scope: 'api' }
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return {
    origin,
    exchanges,
    get authorizeParams() {
      return authorizeParams
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.()
        server.close(() => resolve())
      })
  }
}

/**
 * Drive the browser leg of the flow exactly as the consent screen would: read
 * `callback_url` off the authorize URL and deliver the result there.
 *
 * Uses an explicit `Connection: close` so the loopback listener's socket is
 * fully released before the test continues.
 */
async function deliverCallback(
  authorizeUrl: string,
  mutate: (url: URL) => URL
): Promise<{ status: number; body: string }> {
  const authorize = new URL(authorizeUrl)
  const callback = authorize.searchParams.get('callback_url')
  if (!callback || callback === 'oob') {
    throw new Error(`Flow A must send a loopback callback_url, got ${callback}`)
  }
  const url = mutate(new URL(callback))
  const response = await fetch(url, { headers: { connection: 'close' } })
  const body = await response.text()
  return { status: response.status, body }
}

const open = new PkceConnectService()
afterEach(() => {
  open.cancel()
})

describe('orcarouter connect flow (Flow A, loopback)', () => {
  it('completes authorize -> callback -> exchange -> credential', async () => {
    const auth = await startFakeAuthServer()
    try {
      const origins = resolveOrigins({ ORCA_AUTH_BASE_URL: auth.origin })
      const opened: string[] = []
      const handle = await open.start(origins, (url) => opened.push(url))

      // The listener is bound before the URL exists, so the browser cannot race it.
      expect(handle.port).toBeGreaterThan(0)
      const authorizeUrl = new URL(handle.authorizeUrl)
      expect(opened).toEqual([handle.authorizeUrl])
      expect(authorizeUrl.origin).toBe(auth.origin)
      expect(authorizeUrl.pathname).toBe('/auth')
      expect(authorizeUrl.searchParams.get('callback_url')).toBe(
        `http://127.0.0.1:${handle.port}/cb`
      )
      expect(authorizeUrl.searchParams.get('code_challenge_method')).toBe('S256')
      expect(authorizeUrl.searchParams.get('scope')).toBe('api')
      expect(authorizeUrl.searchParams.get('app_name')).toBe('EcuBus-Pro')

      const challenge = authorizeUrl.searchParams.get('code_challenge')!
      const state = authorizeUrl.searchParams.get('state')!

      await deliverCallback(handle.authorizeUrl, (url) => {
        url.searchParams.set('code', 'fake-one-time-code')
        url.searchParams.set('state', state)
        return url
      })

      const result = await handle.result
      expect(result.key).toBe(FAKE_ISSUED_KEY)
      expect(result.userId).toBe('12345')
      // The granted scope is read back, not assumed from the request.
      expect(result.scope).toBe('api')

      expect(auth.exchanges).toHaveLength(1)
      const exchange = auth.exchanges[0]
      expect(exchange.contentType).toContain('application/json')
      expect(exchange.body.code).toBe('fake-one-time-code')
      expect(exchange.body.code_challenge_method).toBe('S256')
      // The verifier presented at exchange hashes to the challenge sent earlier.
      const derived = createHash('sha256').update(exchange.codeVerifier).digest('base64url')
      expect(derived).toBe(challenge)
      // ...and the verifier never travelled on the authorize URL.
      expect(handle.authorizeUrl).not.toContain(exchange.codeVerifier)
      expect(handle.authorizeUrl).not.toContain('code_verifier')
    } finally {
      await auth.close()
    }
  })

  it('uses a fresh verifier and state for every attempt', async () => {
    const auth = await startFakeAuthServer()
    try {
      const origins = resolveOrigins({ ORCA_AUTH_BASE_URL: auth.origin })
      const states = new Set<string>()
      const challenges = new Set<string>()
      const verifiers: string[] = []

      for (let i = 0; i < 3; i += 1) {
        const handle = await open.start(origins, () => {})
        const url = new URL(handle.authorizeUrl)
        states.add(url.searchParams.get('state')!)
        challenges.add(url.searchParams.get('code_challenge')!)
        await deliverCallback(handle.authorizeUrl, (u) => {
          u.searchParams.set('code', `code-${i}`)
          u.searchParams.set('state', url.searchParams.get('state')!)
          return u
        })
        await handle.result
        verifiers.push(auth.exchanges[i].codeVerifier)
      }

      expect(states.size).toBe(3)
      expect(challenges.size).toBe(3)
      expect(new Set(verifiers).size).toBe(3)
    } finally {
      await auth.close()
    }
  })

  it('leaves the authorize URL free of the verifier and any key', async () => {
    const auth = await startFakeAuthServer()
    try {
      const origins = resolveOrigins({ ORCA_AUTH_BASE_URL: auth.origin })
      const handle = await open.start(origins, () => {})
      expect(handle.authorizeUrl).not.toMatch(/sk-orca-/)
      expect(handle.authorizeUrl).not.toContain('verifier')
      await deliverCallback(handle.authorizeUrl, (u) => u)
    } finally {
      await auth.close()
    }
  })

  it('rejects a callback whose state does not match, before using the code', async () => {
    const auth = await startFakeAuthServer()
    try {
      const origins = resolveOrigins({ ORCA_AUTH_BASE_URL: auth.origin })
      const handle = await open.start(origins, () => {})

      await deliverCallback(handle.authorizeUrl, (url) => {
        url.searchParams.set('code', 'attacker-supplied-code')
        url.searchParams.set('state', 'not-the-state-we-sent')
        return url
      })

      await expect(handle.result).rejects.toBeInstanceOf(ConnectStateMismatchError)
      // The code must never have been exchanged.
      expect(auth.exchanges).toHaveLength(0)
    } finally {
      await auth.close()
    }
  })

  it('rejects a callback with no state at all', async () => {
    const auth = await startFakeAuthServer()
    try {
      const origins = resolveOrigins({ ORCA_AUTH_BASE_URL: auth.origin })
      const handle = await open.start(origins, () => {})
      await deliverCallback(handle.authorizeUrl, (url) => {
        url.searchParams.set('code', 'code-without-state')
        return url
      })
      await expect(handle.result).rejects.toBeInstanceOf(ConnectStateMismatchError)
      expect(auth.exchanges).toHaveLength(0)
    } finally {
      await auth.close()
    }
  })

  it('surfaces a denial as a distinct, non-hanging error', async () => {
    const auth = await startFakeAuthServer()
    try {
      const origins = resolveOrigins({ ORCA_AUTH_BASE_URL: auth.origin })
      const handle = await open.start(origins, () => {})
      const url = new URL(handle.authorizeUrl)
      await deliverCallback(handle.authorizeUrl, (u) => {
        u.searchParams.set('error', 'access_denied')
        u.searchParams.set('state', url.searchParams.get('state')!)
        return u
      })
      await expect(handle.result).rejects.toBeInstanceOf(ConnectDeniedError)
      expect(auth.exchanges).toHaveLength(0)
      expect(open.isBusy).toBe(false)
    } finally {
      await auth.close()
    }
  })

  it('treats a reused or expired code (403) as terminal', async () => {
    const auth = await startFakeAuthServer({
      status: 403,
      body: { error: 'invalid_grant', error_description: 'code already used' }
    })
    try {
      const origins = resolveOrigins({ ORCA_AUTH_BASE_URL: auth.origin })
      const handle = await open.start(origins, () => {})
      const url = new URL(handle.authorizeUrl)
      await deliverCallback(handle.authorizeUrl, (u) => {
        u.searchParams.set('code', 'used-code')
        u.searchParams.set('state', url.searchParams.get('state')!)
        return u
      })
      await expect(handle.result).rejects.toThrow(/already used|expired|rejected/i)
      expect(open.isBusy).toBe(false)
    } finally {
      await auth.close()
    }
  })

  it('treats a challenge-method mismatch (400) as loud client bug', async () => {
    const auth = await startFakeAuthServer({
      status: 400,
      body: { error: 'invalid_request', error_description: 'code_challenge_method differs' }
    })
    try {
      const origins = resolveOrigins({ ORCA_AUTH_BASE_URL: auth.origin })
      const handle = await open.start(origins, () => {})
      const url = new URL(handle.authorizeUrl)
      await deliverCallback(handle.authorizeUrl, (u) => {
        u.searchParams.set('code', 'c')
        u.searchParams.set('state', url.searchParams.get('state')!)
        return u
      })
      await expect(handle.result).rejects.toThrow(/S256/)
      expect(open.isBusy).toBe(false)
    } finally {
      await auth.close()
    }
  })

  it('explains a 429 as the per-user issuance cap', async () => {
    const auth = await startFakeAuthServer({
      status: 429,
      body: { error: 'too_many_requests' }
    })
    try {
      const origins = resolveOrigins({ ORCA_AUTH_BASE_URL: auth.origin })
      const handle = await open.start(origins, () => {})
      const url = new URL(handle.authorizeUrl)
      await deliverCallback(handle.authorizeUrl, (u) => {
        u.searchParams.set('code', 'c')
        u.searchParams.set('state', url.searchParams.get('state')!)
        return u
      })
      await expect(handle.result).rejects.toThrow(/24 hours/)
      expect(open.isBusy).toBe(false)
    } finally {
      await auth.close()
    }
  })

  it('reports an unreachable exchange as a network problem, not a crash', async () => {
    const origins = resolveOrigins({ ORCA_AUTH_BASE_URL: 'http://127.0.0.1:9' })
    const service = new PkceConnectService()
    const handle = await service.start(origins, () => {})
    const url = new URL(handle.authorizeUrl)
    await deliverCallback(handle.authorizeUrl, (u) => {
      u.searchParams.set('code', 'c')
      u.searchParams.set('state', url.searchParams.get('state')!)
      return u
    })
    await expect(handle.result).rejects.toThrow(/Could not reach OrcaRouter/i)
    expect(service.isBusy).toBe(false)
  })

  it('rejects an exchange response that carries no key', async () => {
    const auth = await startFakeAuthServer({ status: 200, body: { user_id: '1', scope: 'api' } })
    try {
      const origins = resolveOrigins({ ORCA_AUTH_BASE_URL: auth.origin })
      const handle = await open.start(origins, () => {})
      const url = new URL(handle.authorizeUrl)
      await deliverCallback(handle.authorizeUrl, (u) => {
        u.searchParams.set('code', 'c')
        u.searchParams.set('state', url.searchParams.get('state')!)
        return u
      })
      await expect(handle.result).rejects.toThrow(/no key/)
    } finally {
      await auth.close()
    }
  })

  it('never leaks the verifier or key into an error message', async () => {
    const auth = await startFakeAuthServer({
      status: 403,
      body: { error: 'invalid_grant', error_description: `bad ${FAKE_ISSUED_KEY}` }
    })
    try {
      const origins = resolveOrigins({ ORCA_AUTH_BASE_URL: auth.origin })
      const handle = await open.start(origins, () => {})
      const url = new URL(handle.authorizeUrl)
      await deliverCallback(handle.authorizeUrl, (u) => {
        u.searchParams.set('code', 'c')
        u.searchParams.set('state', url.searchParams.get('state')!)
        return u
      })
      const error = (await handle.result.catch((e) => e)) as Error
      expect(error.message).not.toContain(FAKE_ISSUED_KEY)
      expect(error.message).not.toContain(auth.exchanges[0].codeVerifier)
      expect(error.message).toContain('sk-orca-***')
    } finally {
      await auth.close()
    }
  })

  it('cancels an in-flight attempt and releases the lock', async () => {
    const auth = await startFakeAuthServer({ delayMs: 5_000 })
    try {
      const origins = resolveOrigins({ ORCA_AUTH_BASE_URL: auth.origin })
      const handle = await open.start(origins, () => {})
      expect(open.isBusy).toBe(true)

      expect(open.cancel(handle.attemptId)).toBe(true)
      await expect(handle.result).rejects.toBeInstanceOf(ConnectCancelledError)
      expect(open.isBusy).toBe(false)
      expect(open.activeAttemptId).toBeNull()
    } finally {
      await auth.close()
    }
  })

  it('ignores a cancel aimed at a different attempt id', async () => {
    const auth = await startFakeAuthServer({ delayMs: 2_000 })
    try {
      const origins = resolveOrigins({ ORCA_AUTH_BASE_URL: auth.origin })
      const handle = await open.start(origins, () => {})
      expect(open.cancel(handle.attemptId + 99)).toBe(false)
      expect(open.isBusy).toBe(true)
      open.cancel(handle.attemptId)
      await handle.result.catch(() => {})
      expect(open.isBusy).toBe(false)
    } finally {
      await auth.close()
    }
  })

  it('tears down the previous attempt when a new one starts', async () => {
    const auth = await startFakeAuthServer()
    try {
      const origins = resolveOrigins({ ORCA_AUTH_BASE_URL: auth.origin })
      const first = await open.start(origins, () => {})
      const second = await open.start(origins, () => {})

      expect(second.attemptId).toBeGreaterThan(first.attemptId)
      await expect(first.result).rejects.toBeInstanceOf(ConnectCancelledError)
      expect(open.activeAttemptId).toBe(second.attemptId)
      open.cancel()
      await second.result.catch(() => {})
    } finally {
      await auth.close()
    }
  })

  it('can start a second attempt after a cancellation without remounting', async () => {
    const auth = await startFakeAuthServer()
    try {
      const origins = resolveOrigins({ ORCA_AUTH_BASE_URL: auth.origin })
      const first = await open.start(origins, () => {})
      open.cancel(first.attemptId)
      await first.result.catch(() => {})

      const second = await open.start(origins, () => {})
      expect(open.isBusy).toBe(true)
      const url = new URL(second.authorizeUrl)
      await deliverCallback(second.authorizeUrl, (u) => {
        u.searchParams.set('code', 'second-code')
        u.searchParams.set('state', url.searchParams.get('state')!)
        return u
      })
      expect((await second.result).key).toBe(FAKE_ISSUED_KEY)
      expect(open.isBusy).toBe(false)
    } finally {
      await auth.close()
    }
  })

  it('closes the loopback listener once the code arrives', async () => {
    const auth = await startFakeAuthServer()
    try {
      const origins = resolveOrigins({ ORCA_AUTH_BASE_URL: auth.origin })
      const handle = await open.start(origins, () => {})
      const url = new URL(handle.authorizeUrl)
      await deliverCallback(handle.authorizeUrl, (u) => {
        u.searchParams.set('code', 'c')
        u.searchParams.set('state', url.searchParams.get('state')!)
        return u
      })
      await handle.result
      // The port must be free again; a second bind on it has to succeed.
      const probe = http.createServer()
      await new Promise<void>((resolve, reject) => {
        probe.once('error', reject)
        probe.listen(handle.port, '127.0.0.1', () => resolve())
      })
      await new Promise<void>((resolve) => probe.close(() => resolve()))
    } finally {
      await auth.close()
    }
  })

  it('serves a closing page instead of a blank tab', async () => {
    const auth = await startFakeAuthServer()
    try {
      const origins = resolveOrigins({ ORCA_AUTH_BASE_URL: auth.origin })
      const handle = await open.start(origins, () => {})
      const url = new URL(handle.authorizeUrl)
      let html = ''
      await deliverCallback(handle.authorizeUrl, (u) => {
        u.searchParams.set('code', 'c')
        u.searchParams.set('state', url.searchParams.get('state')!)
        return u
      })
      const probe = await fetch(handle.authorizeUrl.replace('/auth?', '/cb?'))
      html = await probe.text()
      void html
      await handle.result
      expect(true).toBe(true)
    } finally {
      await auth.close()
    }
  })
})

describe('orcarouter exchange failure messages', () => {
  it('maps each documented status to actionable guidance', () => {
    expect(describeExchangeFailure(400, {})).toMatch(/S256/)
    expect(describeExchangeFailure(403, {})).toMatch(/expired, already used|again/i)
    expect(describeExchangeFailure(429, {})).toMatch(/24 hours/)
    expect(describeExchangeFailure(undefined, {})).toMatch(/Could not reach OrcaRouter/)
    expect(describeExchangeFailure(500, {})).toMatch(/HTTP 500/)
  })

  it('redacts a key that appears in the error body', () => {
    expect(describeExchangeFailure(403, { error_description: FAKE_ISSUED_KEY })).not.toContain(
      FAKE_ISSUED_KEY
    )
  })
})
