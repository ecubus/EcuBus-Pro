import { describe, expect, it, vi } from 'vitest'
import { ModelDiscovery, describeDiscoveryError } from '../../src/main/orcarouter/discovery'
import { VERIFIED_FALLBACK_SEED } from '../../src/main/orcarouter/catalog'

const LIVE = {
  data: [
    {
      id: 'anthropic/claude-opus-4.8',
      supported_endpoint_types: ['anthropic', 'openai'],
      context_length: 1000000,
      architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] }
    },
    {
      id: 'openai/gpt-oss-120b',
      supported_endpoint_types: ['openai'],
      architecture: { input_modalities: ['text'], output_modalities: ['text'] }
    }
  ]
}

describe('orcarouter model discovery', () => {
  it('uses the live catalog as authoritative', async () => {
    const discovery = new ModelDiscovery(async () => LIVE)
    const result = await discovery.resolve({ capability: 'chat' })
    expect(result.source).toBe('live')
    expect(result.degraded).toBe(false)
    expect(result.models.map((m) => m.id)).toEqual([
      'anthropic/claude-opus-4.8',
      'openai/gpt-oss-120b'
    ])
    // The seed is not mixed into a successful live result.
    expect(result.models.map((m) => m.id)).not.toContain('orcarouter/auto')
  })

  it('requests the capability from the transport', async () => {
    const fetcher = vi.fn(async () => LIVE)
    const discovery = new ModelDiscovery(fetcher)
    await discovery.resolve({ capability: 'embedding' })
    expect(fetcher).toHaveBeenCalledWith('embedding')
  })

  it('serves a second call from cache within the TTL', async () => {
    const fetcher = vi.fn(async () => LIVE)
    let now = 1_000
    const discovery = new ModelDiscovery(fetcher, { ttlMs: 1_000, now: () => now })

    await discovery.resolve({ capability: 'chat' })
    now += 500
    const cached = await discovery.resolve({ capability: 'chat' })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(cached.source).toBe('cache')
    expect(cached.degraded).toBe(false)
  })

  it('re-fetches once the TTL has elapsed', async () => {
    const fetcher = vi.fn(async () => LIVE)
    let now = 1_000
    const discovery = new ModelDiscovery(fetcher, { ttlMs: 1_000, now: () => now })
    await discovery.resolve({ capability: 'chat' })
    now += 5_000
    await discovery.resolve({ capability: 'chat' })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('re-fetches on an explicit refresh', async () => {
    const fetcher = vi.fn(async () => LIVE)
    const discovery = new ModelDiscovery(fetcher, { ttlMs: 60_000 })
    await discovery.resolve({ capability: 'chat' })
    await discovery.resolve({ capability: 'chat' }, true)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('caches per capability so one refresh does not blank another', async () => {
    const fetcher = vi.fn(async (capability?: string) =>
      capability === 'embedding'
        ? {
            data: [
              { id: 'openai/text-embedding-3-large', supported_endpoint_types: ['embeddings'] }
            ]
          }
        : LIVE
    )
    const discovery = new ModelDiscovery(fetcher, { ttlMs: 60_000 })
    await discovery.resolve({ capability: 'chat' })
    await discovery.resolve({ capability: 'embedding' })
    const chat = await discovery.resolve({ capability: 'chat' })
    expect(chat.models.map((m) => m.id)).toContain('anthropic/claude-opus-4.8')
  })

  it('falls back to the verified seed when discovery throws', async () => {
    const discovery = new ModelDiscovery(async () => {
      throw new Error('ECONNREFUSED')
    })
    const result = await discovery.resolve({ capability: 'chat' })
    expect(result.source).toBe('seed')
    expect(result.degraded).toBe(true)
    expect(result.reason).toBeTruthy()
    expect(result.models.map((m) => m.id)).toEqual(VERIFIED_FALLBACK_SEED.map((m) => m.id))
  })

  it('keeps the seed reasoning metadata when degraded', async () => {
    const discovery = new ModelDiscovery(async () => {
      throw new Error('offline')
    })
    const result = await discovery.resolve({ capability: 'chat' })
    const gpt = result.models.find((m) => m.id === 'openai/gpt-5.5')
    expect(gpt?.reasoning).toBe(true)
    expect(gpt?.reasoningEfforts).toEqual(['low', 'medium', 'high', 'xhigh'])
  })

  it('falls back when the catalog is empty rather than showing nothing', async () => {
    const discovery = new ModelDiscovery(async () => ({ data: [] }))
    const result = await discovery.resolve({ capability: 'chat' })
    expect(result.source).toBe('seed')
    expect(result.degraded).toBe(true)
    expect(result.reason).toMatch(/empty/i)
  })

  it('prefers a last known-good catalog over the seed during an outage', async () => {
    let fail = false
    const fetcher = async () => {
      if (fail) throw new Error('offline')
      return LIVE
    }
    let now = 1_000
    const discovery = new ModelDiscovery(fetcher, { ttlMs: 100, now: () => now })
    await discovery.resolve({ capability: 'chat' })
    fail = true
    now += 10_000

    const result = await discovery.resolve({ capability: 'chat' })
    expect(result.source).toBe('cache')
    expect(result.degraded).toBe(true)
    expect(result.models.map((m) => m.id)).toEqual([
      'anthropic/claude-opus-4.8',
      'openai/gpt-oss-120b'
    ])
    expect(result.models.map((m) => m.id)).not.toContain('orcarouter/auto')
  })

  it('bounds a hanging request with a timeout', async () => {
    const discovery = new ModelDiscovery(() => new Promise(() => {}), { timeoutMs: 20 })
    const result = await discovery.resolve({ capability: 'chat' })
    expect(result.degraded).toBe(true)
    expect(result.reason).toMatch(/timed out/i)
    expect(result.source).toBe('seed')
  })

  it('applies the capability filter to a fallback list', async () => {
    const discovery = new ModelDiscovery(async () => {
      throw new Error('offline')
    })
    const embeddings = await discovery.resolve({ capability: 'embedding' })
    // Nothing in the verified seed is an embedding model, so the list is empty
    // and the UI shows its empty state rather than an unverified suggestion.
    expect(embeddings.models).toEqual([])
    expect(embeddings.degraded).toBe(true)
  })

  it('applies the multimodal filter to a fallback list', async () => {
    const discovery = new ModelDiscovery(async () => {
      throw new Error('offline')
    })
    const multimodal = await discovery.resolve({ capability: 'chat', modality: 'image' })
    expect(multimodal.models.map((m) => m.id)).toContain('openai/gpt-5.5')
    expect(multimodal.models.map((m) => m.id)).not.toContain('deepseek/deepseek-v4-pro')
  })

  it('clears every cached catalog', async () => {
    const fetcher = vi.fn(async () => LIVE)
    const discovery = new ModelDiscovery(fetcher, { ttlMs: 60_000 })
    await discovery.resolve({ capability: 'chat' })
    discovery.clear()
    await discovery.resolve({ capability: 'chat' })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('refreshes several capabilities at once', async () => {
    const fetcher = vi.fn(async () => LIVE)
    const discovery = new ModelDiscovery(fetcher, { ttlMs: 60_000 })
    await discovery.refresh(['chat', 'embedding'])
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('never puts an error body into the degraded reason', () => {
    expect(describeDiscoveryError(new Error('Request failed with status code 401'))).toMatch(
      /rejected the credential/
    )
    expect(describeDiscoveryError(new Error('timeout of 10000ms exceeded timed out'))).toMatch(
      /timed out/
    )
    expect(describeDiscoveryError(new Error('sk-orca-leak'))).not.toContain('sk-orca-leak')
  })
})
