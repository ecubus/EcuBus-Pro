import { describe, expect, it } from 'vitest'
import http from 'node:http'
import { AddressInfo } from 'node:net'
import { createHash } from 'node:crypto'
import { OrcaService, OrcaStoragePort } from '../../src/main/orcarouter/service'
import { resolveOrigins } from '../../src/main/orcarouter/origins'
import { CredentialRejectedError } from '../../src/main/orcarouter/credentials'

const BROWSER_KEY = 'sk-orca-browser0000000000000000000000000'
const PASTED_KEY = 'sk-orca-pasted00000000000000000000000000'

/** In-memory stand-in for the safeStorage-backed vault. */
class FakeStorage implements OrcaStoragePort {
  saved: { key: string; source: string; accountId: string } | null = null
  clearCount = 0
  saveCount = 0
  save(envelope: { key: string; source: 'apiKey' | 'pkce'; accountId: string }): void {
    this.saved = { key: envelope.key, source: envelope.source, accountId: envelope.accountId }
    this.saveCount += 1
  }
  load(): any {
    return this.saved
  }
  clear(): void {
    this.saved = null
    this.clearCount += 1
  }
  encryptionAvailable(): boolean {
    return true
  }
}

interface FakeAuthServer {
  origin: string
  exchanges: any[]
  lastAuthorizeUrl: URL | null
  close(): Promise<void>
}

/** Local fake of the OrcaRouter auth origin: /auth plus /api/v1/auth/keys. */
async function startFakeAuthServer(
  options: { key?: string; userId?: string; scope?: string; status?: number } = {}
): Promise<FakeAuthServer> {
  const exchanges: any[] = []
  let lastAuthorizeUrl: URL | null = null
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (req.method === 'GET' && url.pathname === '/auth') {
      lastAuthorizeUrl = url
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<p>consent</p>')
      return
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/auth/keys') {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        exchanges.push(JSON.parse(raw))
        const status = options.status ?? 200
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            key: options.key ?? BROWSER_KEY,
            user_id: options.userId ?? '12345',
            scope: options.scope ?? 'api'
          })
        )
      })
      return
    }
    res.writeHead(404)
    res.end()
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    exchanges,
    get lastAuthorizeUrl() {
      return lastAuthorizeUrl
    },
    close: () =>
      new Promise<void>((r) => {
        server.closeAllConnections?.()
        server.close(() => r())
      })
  }
}

interface FakeRelay {
  origin: string
  requests: { path: string; authorization?: string; body?: any }[]
  close(): Promise<void>
}

/** Local fake of the OrcaRouter relay: /v1/models and /v1/chat/completions. */
async function startFakeRelay(options: { chatStatus?: number } = {}): Promise<FakeRelay> {
  const requests: FakeRelay['requests'] = []
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      requests.push({
        path: url.pathname + url.search,
        authorization: req.headers.authorization,
        body: raw ? JSON.parse(raw) : undefined
      })
      if (url.pathname === '/v1/models') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            data: [
              {
                id: 'anthropic/claude-opus-4.8',
                supported_endpoint_types: ['anthropic', 'openai'],
                architecture: { input_modalities: ['text', 'image'] }
              },
              {
                id: 'deepseek/deepseek-v4-pro',
                supported_endpoint_types: ['openai'],
                architecture: { input_modalities: ['text'] }
              }
            ]
          })
        )
        return
      }
      const status = options.chatStatus ?? 200
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify(
          status === 200
            ? { model: 'anthropic/claude-opus-4.8', choices: [{ message: { content: 'pong' } }] }
            : { error: 'revoked' }
        )
      )
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    requests,
    close: () =>
      new Promise<void>((r) => {
        server.closeAllConnections?.()
        server.close(() => r())
      })
  }
}

/** Build a service wired to the fake auth origin and the fake relay. */
function makeService(
  authOrigin: string,
  relayOrigin: string,
  storage: FakeStorage,
  opened: string[] = []
): OrcaService {
  return new OrcaService({
    origins: resolveOrigins({ ORCA_AUTH_BASE_URL: authOrigin, ORCA_API_BASE_URL: relayOrigin }),
    openBrowser: (url) => opened.push(url),
    storage
  })
}

/** Deliver the authorization code to the loopback callback_url. */
async function approveLoopback(authorizeUrl: string, code = 'fake-code'): Promise<void> {
  const url = new URL(authorizeUrl)
  const callback = url.searchParams.get('callback_url')!
  const target = new URL(callback)
  target.searchParams.set('code', code)
  target.searchParams.set('state', url.searchParams.get('state')!)
  const response = await fetch(target, { headers: { connection: 'close' } })
  await response.text()
}

describe('orcarouter dual authentication', () => {
  it('produces the same credential shape from both adapters', async () => {
    const auth = await startFakeAuthServer()
    const relay = await startFakeRelay()
    try {
      const viaKey = new OrcaService({
        origins: resolveOrigins({
          ORCA_AUTH_BASE_URL: auth.origin,
          ORCA_API_BASE_URL: relay.origin
        }),
        openBrowser: () => {},
        storage: new FakeStorage()
      })
      const keyStatus = await viaKey.setApiKey(PASTED_KEY)
      expect(keyStatus).toMatchObject({ status: 'configured', source: 'apiKey' })

      const viaPkce = makeService(auth.origin, relay.origin, new FakeStorage())
      await viaPkce.setApiKey(PASTED_KEY) // seed the store's adapter plumbing
      viaPkce.logout()
      const started = await viaPkce.startConnect()
      await approveLoopback(started.authorizeUrl)
      const pkceStatus = await viaPkce.awaitConnect(started.attemptId)
      expect(pkceStatus).toMatchObject({ status: 'configured', source: 'pkce' })

      // Same credential record shape, different provenance.
      expect(Object.keys(keyStatus).sort()).toEqual(Object.keys(pkceStatus).sort())
      expect(viaPkce.store.getCredential()?.key).toBe(BROWSER_KEY)
    } finally {
      await auth.close()
      await relay.close()
    }
  })

  it('routes inference to the API origin with Bearer auth for a pasted key', async () => {
    const auth = await startFakeAuthServer()
    const relay = await startFakeRelay()
    try {
      const service = makeService(auth.origin, relay.origin, new FakeStorage())
      await service.setApiKey(PASTED_KEY)
      const result = await service.chat({
        model: 'anthropic/claude-opus-4.8',
        messages: [{ role: 'user', content: 'ping' }]
      })
      expect(result.content).toBe('pong')
      expect(relay.requests[0].path).toBe('/v1/chat/completions')
      expect(relay.requests[0].authorization).toBe(`Bearer ${PASTED_KEY}`)
      // No auth-origin traffic happened for the API-key path.
      expect(auth.exchanges).toHaveLength(0)
    } finally {
      await auth.close()
      await relay.close()
    }
  })

  it('routes inference through the same path for a PKCE credential', async () => {
    const auth = await startFakeAuthServer()
    const relay = await startFakeRelay()
    try {
      const service = makeService(auth.origin, relay.origin, new FakeStorage())
      const started = await service.startConnect()
      await approveLoopback(started.authorizeUrl)
      await service.awaitConnect(started.attemptId)

      const result = await service.chat({
        model: 'anthropic/claude-opus-4.8',
        messages: [{ role: 'user', content: 'ping' }]
      })
      expect(result.content).toBe('pong')
      // Same relay, same wire format, same Bearer header as the pasted key.
      expect(relay.requests[0].path).toBe('/v1/chat/completions')
      expect(relay.requests[0].authorization).toBe(`Bearer ${BROWSER_KEY}`)
    } finally {
      await auth.close()
      await relay.close()
    }
  })

  it('discovers models identically for both credential sources', async () => {
    const auth = await startFakeAuthServer()
    const relay = await startFakeRelay()
    try {
      const viaKey = makeService(auth.origin, relay.origin, new FakeStorage())
      await viaKey.setApiKey(PASTED_KEY)
      const keyModels = await viaKey.getModels({ capability: 'chat' })

      const viaPkce = makeService(auth.origin, relay.origin, new FakeStorage())
      const started = await viaPkce.startConnect()
      await approveLoopback(started.authorizeUrl)
      await viaPkce.awaitConnect(started.attemptId)
      const pkceModels = await viaPkce.getModels({ capability: 'chat' })

      expect(keyModels.models.map((m) => m.id)).toEqual(pkceModels.models.map((m) => m.id))
      expect(keyModels.source).toBe('live')
      // Discovery and inference share one origin, and never the auth origin.
      expect(relay.requests.every((r) => r.path.startsWith('/v1/'))).toBe(true)
      expect(auth.exchanges).toHaveLength(1)
    } finally {
      await auth.close()
      await relay.close()
    }
  })

  it('filters the selector to image-capable chat models when an image is attached', async () => {
    const auth = await startFakeAuthServer()
    const relay = await startFakeRelay()
    try {
      const service = makeService(auth.origin, relay.origin, new FakeStorage())
      await service.setApiKey(PASTED_KEY)

      const text = await service.getModels({ capability: 'chat', modality: 'text' })
      const image = await service.getModels({ capability: 'chat', modality: 'image' })

      expect(text.models.map((m) => m.id)).toEqual([
        'anthropic/claude-opus-4.8',
        'deepseek/deepseek-v4-pro'
      ])
      // The text-only model is no longer offered once an image is attached.
      expect(image.models.map((m) => m.id)).toEqual(['anthropic/claude-opus-4.8'])
    } finally {
      await auth.close()
      await relay.close()
    }
  })

  it('persists the credential so a restart reuses it instead of re-authorizing', async () => {
    const auth = await startFakeAuthServer()
    const relay = await startFakeRelay()
    const storage = new FakeStorage()
    try {
      const first = makeService(auth.origin, relay.origin, storage)
      const started = await first.startConnect()
      await approveLoopback(started.authorizeUrl)
      await first.awaitConnect(started.attemptId)
      expect(storage.saveCount).toBe(1)
      expect(storage.saved?.source).toBe('pkce')

      // A second service instance, as after an app restart.
      const second = makeService(auth.origin, relay.origin, storage)
      expect(second.getStatus()).toMatchObject({ status: 'configured', source: 'pkce' })
      expect(second.store.getCredential()?.key).toBe(BROWSER_KEY)

      // No second authorization was started.
      expect(auth.exchanges).toHaveLength(1)
    } finally {
      await auth.close()
      await relay.close()
    }
  })

  it('does not re-authorize on every launch even after many starts', async () => {
    const auth = await startFakeAuthServer()
    const relay = await startFakeRelay()
    const storage = new FakeStorage()
    try {
      const service = makeService(auth.origin, relay.origin, storage)
      const started = await service.startConnect()
      await approveLoopback(started.authorizeUrl)
      await service.awaitConnect(started.attemptId)

      // Ten more "launches".
      for (let i = 0; i < 10; i += 1) {
        const restarted = makeService(auth.origin, relay.origin, storage)
        expect(restarted.getStatus().status).toBe('configured')
      }
      expect(auth.exchanges).toHaveLength(1)
    } finally {
      await auth.close()
      await relay.close()
    }
  })

  it('rejects an API-key-shaped value that is not an OrcaRouter key', async () => {
    const auth = await startFakeAuthServer()
    const relay = await startFakeRelay()
    try {
      const service = makeService(auth.origin, relay.origin, new FakeStorage())
      await expect(service.setApiKey('sk-openai-not-ours')).rejects.toThrow(/sk-orca-/)
      expect(service.getStatus().status).toBe('none')
    } finally {
      await auth.close()
      await relay.close()
    }
  })

  it('keeps both entries usable: a key still works after a PKCE login is cleared', async () => {
    const auth = await startFakeAuthServer()
    const relay = await startFakeRelay()
    const storage = new FakeStorage()
    try {
      const service = makeService(auth.origin, relay.origin, storage)
      const started = await service.startConnect()
      await approveLoopback(started.authorizeUrl)
      await service.awaitConnect(started.attemptId)

      service.logout()
      expect(service.getStatus().status).toBe('none')
      expect(storage.saved).toBeNull()

      await service.setApiKey(PASTED_KEY)
      expect(service.getStatus()).toMatchObject({ status: 'configured', source: 'apiKey' })
      await service.chat({ model: 'm', messages: [{ role: 'user', content: 'hi' }] })
      expect(relay.requests.at(-1)?.authorization).toBe(`Bearer ${PASTED_KEY}`)
    } finally {
      await auth.close()
      await relay.close()
    }
  })

  it('does not silently delete the old secret before a replacement succeeds', async () => {
    const auth = await startFakeAuthServer()
    const relay = await startFakeRelay()
    const storage = new FakeStorage()
    try {
      const service = makeService(auth.origin, relay.origin, storage)
      await service.setApiKey(PASTED_KEY)
      const before = storage.saved?.key

      // A failed connect must leave the stored credential untouched.
      const started = await service.startConnect()
      service.cancelConnect(started.attemptId)
      await expect(service.awaitConnect(started.attemptId)).rejects.toThrow()
      expect(storage.saved?.key).toBe(before)
      expect(service.getStatus().status).toBe('configured')
    } finally {
      await auth.close()
      await relay.close()
    }
  })

  it('marks exactly the rejected account and generation for reauthentication', async () => {
    const auth = await startFakeAuthServer()
    const goodRelay = await startFakeRelay()
    const revokedRelay = await startFakeRelay({ chatStatus: 401 })
    try {
      const service = makeService(auth.origin, revokedRelay.origin, new FakeStorage())
      await service.setApiKey(PASTED_KEY)
      const rejectedTicket = service.store.credentialForRequest()

      const error = await service
        .chat({ model: 'm', messages: [{ role: 'user', content: 'hi' }] })
        .catch((e) => e)
      expect(error).toBeInstanceOf(CredentialRejectedError)

      const status = service.getStatus()
      expect(status.status).toBe('needsReauth')
      expect(status.accountId).toBe(rejectedTicket.accountId)
      expect(status.generation).toBe(rejectedTicket.generation)

      // The stored secret is retained: a transient failure must not destroy it.
      expect(service.store.getCredential()).not.toBeNull()
    } finally {
      await auth.close()
      await goodRelay.close()
      await revokedRelay.close()
    }
  })

  it('does not attempt a refresh on a revoked durable key', async () => {
    const auth = await startFakeAuthServer()
    const relay = await startFakeRelay({ chatStatus: 401 })
    try {
      const service = makeService(auth.origin, relay.origin, new FakeStorage())
      await service.setApiKey(PASTED_KEY)

      for (let i = 0; i < 3; i += 1) {
        await service
          .chat({ model: 'm', messages: [{ role: 'user', content: 'hi' }] })
          .catch(() => {})
      }
      // Exactly one upstream call per attempt: never a hidden refresh, and no
      // auth-origin traffic that a refresh grant would require.
      expect(relay.requests).toHaveLength(3)
      expect(auth.exchanges).toHaveLength(0)
    } finally {
      await auth.close()
      await relay.close()
    }
  })

  it('keeps a new credential working after a late failure from the old generation', async () => {
    const auth = await startFakeAuthServer()
    const relay = await startFakeRelay()
    try {
      const service = makeService(auth.origin, relay.origin, new FakeStorage())
      await service.setApiKey(PASTED_KEY)
      const stale = service.store.credentialForRequest()

      // The user signs in again with a fresh account.
      const started = await service.startConnect()
      await approveLoopback(started.authorizeUrl)
      await service.awaitConnect(started.attemptId)
      expect(service.getStatus()).toMatchObject({ source: 'pkce', status: 'configured' })

      // The old request's 401 arrives now.
      const applied = service.store.markNeedsReauth(stale.accountId, stale.generation)
      expect(applied).toBe(false)
      expect(service.getStatus().status).toBe('configured')
      expect(service.store.getCredential()?.key).toBe(BROWSER_KEY)
    } finally {
      await auth.close()
      await relay.close()
    }
  })

  it('sends the PKCE exchange only to the auth origin', async () => {
    const auth = await startFakeAuthServer()
    const relay = await startFakeRelay()
    try {
      const service = makeService(auth.origin, relay.origin, new FakeStorage())
      const started = await service.startConnect()
      await approveLoopback(started.authorizeUrl, 'the-code')
      await service.awaitConnect(started.attemptId)

      expect(auth.exchanges).toHaveLength(1)
      expect(auth.exchanges[0].code).toBe('the-code')
      expect(auth.exchanges[0].code_challenge_method).toBe('S256')
      // The relay saw no part of the authorization.
      expect(relay.requests.filter((r) => r.path.includes('auth'))).toHaveLength(0)
    } finally {
      await auth.close()
      await relay.close()
    }
  })

  it('reads the granted scope back instead of assuming the requested one', async () => {
    const auth = await startFakeAuthServer({ scope: 'api' })
    const relay = await startFakeRelay()
    try {
      const service = makeService(auth.origin, relay.origin, new FakeStorage())
      const started = await service.startConnect()
      await approveLoopback(started.authorizeUrl)
      const status = await service.awaitConnect(started.attemptId)
      expect(status.scope).toBe('api')
      expect(service.store.getCredential()?.scope).toBe('api')
    } finally {
      await auth.close()
      await relay.close()
    }
  })

  it('surfaces a downgraded grant to the caller', async () => {
    const auth = await startFakeAuthServer({ scope: 'connector' })
    const relay = await startFakeRelay()
    try {
      const service = makeService(auth.origin, relay.origin, new FakeStorage())
      const started = await service.startConnect()
      await approveLoopback(started.authorizeUrl)
      const status = await service.awaitConnect(started.attemptId)
      // The response said `connector`; the client must not pretend it got `api`.
      expect(status.scope).toBe('connector')
    } finally {
      await auth.close()
      await relay.close()
    }
  })

  it('opens the browser exactly once, with the loopback callback', async () => {
    const auth = await startFakeAuthServer()
    const relay = await startFakeRelay()
    const opened: string[] = []
    try {
      const service = makeService(auth.origin, relay.origin, new FakeStorage(), opened)
      const started = await service.startConnect()
      expect(opened).toEqual([started.authorizeUrl])
      expect(new URL(opened[0]).searchParams.get('callback_url')).toMatch(
        /^http:\/\/127\.0\.0\.1:\d+\/cb$/
      )
      await approveLoopback(started.authorizeUrl)
      await service.awaitConnect(started.attemptId)
      expect(opened).toHaveLength(1)
    } finally {
      await auth.close()
      await relay.close()
    }
  })

  it('refuses to read models before a credential exists', async () => {
    const auth = await startFakeAuthServer()
    const relay = await startFakeRelay()
    try {
      const service = makeService(auth.origin, relay.origin, new FakeStorage())
      await expect(service.getModels({ capability: 'chat' })).rejects.toThrow(/not authenticated/i)
    } finally {
      await auth.close()
      await relay.close()
    }
  })

  it('masks the credential in the public status', async () => {
    const auth = await startFakeAuthServer()
    const relay = await startFakeRelay()
    try {
      const service = makeService(auth.origin, relay.origin, new FakeStorage())
      const status = await service.setApiKey(PASTED_KEY)
      expect(status.maskedKey).toBeDefined()
      expect(status.maskedKey).not.toBe(PASTED_KEY)
      expect(status.maskedKey).toMatch(/^sk-orca-•+$/)
      // No character of the live key appears, not even a trailing fragment.
      expect(status.maskedKey).not.toContain(PASTED_KEY.slice(8, 20))
      expect(status.maskedKey).not.toContain(PASTED_KEY.slice(-4))
      expect(status.maskedKey).not.toContain(PASTED_KEY.slice(9, 13))
    } finally {
      await auth.close()
      await relay.close()
    }
  })
})
