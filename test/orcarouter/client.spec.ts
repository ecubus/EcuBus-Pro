import { describe, expect, it, vi } from 'vitest'
import http from 'node:http'
import { AddressInfo } from 'node:net'
import { OrcaClient, OrcaRequestError } from '../../src/main/orcarouter/client'
import { CredentialRejectedError } from '../../src/main/orcarouter/credentials'
import { resolveOrigins } from '../../src/main/orcarouter/origins'

const FAKE_KEY = 'sk-orca-test0000000000000000000000000000'

interface FakeRelay {
  origin: string
  requests: { method: string; path: string; authorization?: string; body?: any }[]
  close(): Promise<void>
}

/** Local stand-in for the OrcaRouter relay (inference + catalog). */
async function startFakeRelay(
  handler: (path: string) => { status: number; body: unknown }
): Promise<FakeRelay> {
  const requests: FakeRelay['requests'] = []
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      requests.push({
        method: req.method!,
        path: url.pathname + url.search,
        authorization: req.headers.authorization,
        body: raw ? JSON.parse(raw) : undefined
      })
      const { status, body } = handler(url.pathname + url.search)
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.()
        server.close(() => resolve())
      })
  }
}

const credential = {
  key: FAKE_KEY,
  source: 'apiKey' as const,
  accountId: 'fp_test',
  generation: 1
}

describe('orcarouter relay client', () => {
  it('sends the model catalog request to /v1/models on the api origin only', async () => {
    const relay = await startFakeRelay(() => ({ status: 200, body: { data: [] } }))
    try {
      const client = new OrcaClient(resolveOrigins({ ORCA_API_BASE_URL: relay.origin }))
      await client.listModels(credential, 'chat')

      expect(relay.requests).toHaveLength(1)
      expect(relay.requests[0].method).toBe('GET')
      expect(relay.requests[0].path).toBe('/v1/models?capability=chat')
      expect(relay.requests[0].authorization).toBe(`Bearer ${FAKE_KEY}`)
    } finally {
      await relay.close()
    }
  })

  it('never sends the credential in the url', async () => {
    const relay = await startFakeRelay(() => ({ status: 200, body: { data: [] } }))
    try {
      const client = new OrcaClient(resolveOrigins({ ORCA_API_BASE_URL: relay.origin }))
      await client.listModels(credential)
      expect(relay.requests[0].path).not.toContain(FAKE_KEY)
      expect(relay.requests[0].path).not.toContain('key=')
    } finally {
      await relay.close()
    }
  })

  it('posts a chat completion to /v1/chat/completions with Bearer auth', async () => {
    const relay = await startFakeRelay(() => ({
      status: 200,
      body: {
        model: 'openai/gpt-5.5',
        choices: [{ message: { content: 'hello' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 }
      }
    }))
    try {
      const client = new OrcaClient(resolveOrigins({ ORCA_API_BASE_URL: relay.origin }))
      const result = await client.chat(credential, {
        model: 'openai/gpt-5.5',
        messages: [{ role: 'user', content: 'hi' }]
      })

      expect(relay.requests[0].path).toBe('/v1/chat/completions')
      expect(relay.requests[0].authorization).toBe(`Bearer ${FAKE_KEY}`)
      expect(relay.requests[0].body.model).toBe('openai/gpt-5.5')
      expect(result.content).toBe('hello')
      expect(result.finishReason).toBe('stop')
      expect(result.usage?.totalTokens).toBe(4)
    } finally {
      await relay.close()
    }
  })

  it('preserves the vendor/model namespace in the request body', async () => {
    const relay = await startFakeRelay(() => ({
      status: 200,
      body: { model: 'anthropic/claude-opus-4.8', choices: [{ message: { content: 'x' } }] }
    }))
    try {
      const client = new OrcaClient(resolveOrigins({ ORCA_API_BASE_URL: relay.origin }))
      await client.chat(credential, {
        model: 'anthropic/claude-opus-4.8',
        messages: [{ role: 'user', content: 'hi' }]
      })
      expect(relay.requests[0].body.model).toBe('anthropic/claude-opus-4.8')
    } finally {
      await relay.close()
    }
  })

  it('turns a 401 into a terminal CredentialRejectedError', async () => {
    const relay = await startFakeRelay(() => ({ status: 401, body: { error: 'revoked' } }))
    try {
      const client = new OrcaClient(resolveOrigins({ ORCA_API_BASE_URL: relay.origin }))
      await expect(
        client.chat(credential, { model: 'm', messages: [{ role: 'user', content: 'hi' }] })
      ).rejects.toBeInstanceOf(CredentialRejectedError)
      // No retry: exactly one request was made.
      expect(relay.requests).toHaveLength(1)
    } finally {
      await relay.close()
    }
  })

  it('reports a 5xx as a normal request error, not a credential problem', async () => {
    const relay = await startFakeRelay(() => ({ status: 503, body: { error: 'unavailable' } }))
    try {
      const client = new OrcaClient(resolveOrigins({ ORCA_API_BASE_URL: relay.origin }))
      const error = await client
        .chat(credential, { model: 'm', messages: [{ role: 'user', content: 'hi' }] })
        .catch((e) => e)
      expect(error).toBeInstanceOf(OrcaRequestError)
      expect(error.status).toBe(503)
      expect(error).not.toBeInstanceOf(CredentialRejectedError)
    } finally {
      await relay.close()
    }
  })

  it('reports an unreachable relay without leaking the credential', async () => {
    const client = new OrcaClient(resolveOrigins({ ORCA_API_BASE_URL: 'http://127.0.0.1:9' }))
    const error = (await client
      .chat(credential, { model: 'm', messages: [{ role: 'user', content: 'hi' }] })
      .catch((e) => e)) as Error
    expect(error).toBeInstanceOf(OrcaRequestError)
    expect(error.message).toMatch(/Could not reach OrcaRouter/)
    expect(error.message).not.toContain(FAKE_KEY)
  })

  it('surfaces an auth failure on the catalog request', async () => {
    const relay = await startFakeRelay(() => ({ status: 401, body: {} }))
    try {
      const client = new OrcaClient(resolveOrigins({ ORCA_API_BASE_URL: relay.origin }))
      await expect(client.listModels(credential)).rejects.toBeInstanceOf(CredentialRejectedError)
    } finally {
      await relay.close()
    }
  })

  it('honours an injected http instance', async () => {
    const post = vi.fn(async () => ({
      data: { choices: [{ message: { content: 'ok' } }] },
      status: 200
    }))
    const client = new OrcaClient(resolveOrigins({}), {
      http: { post, get: vi.fn() } as never
    })
    const result = await client.chat(credential, {
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }]
    })
    expect(result.content).toBe('ok')
    expect(post).toHaveBeenCalledOnce()
  })
})
