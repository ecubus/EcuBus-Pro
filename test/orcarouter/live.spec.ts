/**
 * Live checks against the real OrcaRouter service.
 *
 * These are opt-in: they are skipped unless `ORCAROUTER_API_KEY` is set, so the
 * default suite stays offline and deterministic. When the key is present they
 * exercise the *shipped* code path — `resolveOrigins`, `OrcaClient`,
 * `parseCatalogResponse` and the capability filters — not a standalone curl.
 *
 * The key is never logged or asserted on. Only presence/shape is reported.
 */
import { describe, expect, it } from 'vitest'
import { OrcaClient } from '../../src/main/orcarouter/client'
import { OrcaCredential } from '../../src/main/orcarouter/credentials'
import {
  DEFAULT_API_BASE,
  buildChatCompletionsUrl,
  buildModelsUrl,
  resolveOrigins
} from '../../src/main/orcarouter/origins'
import { filterModels, parseCatalogResponse, seedFor } from '../../src/main/orcarouter/catalog'

const apiKey = process.env.ORCAROUTER_API_KEY
const live = apiKey ? describe : describe.skip

function credential(): OrcaCredential {
  return { key: apiKey!, source: 'apiKey', accountId: 'live', generation: 1 }
}

live('orcarouter live catalog (through the shipped provider path)', () => {
  const origins = resolveOrigins()
  const client = new OrcaClient(origins)

  it('defaults to the documented public origins', () => {
    expect(origins.authBase).toBe('https://www.orcarouter.ai')
    expect(origins.apiBase).toBe(DEFAULT_API_BASE)
    expect(buildModelsUrl(origins.apiBase)).toBe('https://api.orcarouter.ai/v1/models')
    expect(buildChatCompletionsUrl(origins.apiBase)).toBe(
      'https://api.orcarouter.ai/v1/chat/completions'
    )
  })

  it('fetches and parses the real chat catalog', async () => {
    const payload = await client.listModels(credential(), 'chat')
    const models = parseCatalogResponse(payload)
    expect(models.length).toBeGreaterThan(50)

    const chat = filterModels(models, { capability: 'chat' })
    expect(chat.length).toBeGreaterThan(50)
    // Ids are preserved verbatim, including the vendor/model namespace. A small
    // minority of records are un-namespaced upstream, so this asserts that the
    // namespaced ids survive unchanged rather than that every id has a slash.
    expect(chat.map((m) => m.id)).toContain('anthropic/claude-opus-4.8')
    expect(chat.filter((m) => m.id.includes('/')).length).toBeGreaterThan(chat.length * 0.9)
    // every entry declares a text-capable endpoint type
    expect(
      chat.every((m) =>
        m.endpointTypes.some((t) =>
          ['openai', 'anthropic', 'gemini', 'openai-response'].includes(t)
        )
      )
    ).toBe(true)

    // eslint-disable-next-line no-console
    console.log(
      `[live] chat catalog: ${models.length} records, ${chat.length} text-capable; sample=${chat
        .slice(0, 3)
        .map((m) => m.id)
        .join(', ')}`
    )
  }, 60_000)

  it('yields fewer, explicitly image-declaring models for the multimodal list', async () => {
    const models = parseCatalogResponse(await client.listModels(credential(), 'chat'))
    const text = filterModels(models, { capability: 'chat' })
    const multimodal = filterModels(models, { capability: 'chat', modality: 'image' })

    expect(multimodal.length).toBeGreaterThan(0)
    expect(multimodal.length).toBeLessThan(text.length)
    // Fail closed: every entry declares image input, and none is an image generator.
    expect(multimodal.every((m) => m.inputModalities.includes('image'))).toBe(true)
    expect(multimodal.every((m) => !m.endpointTypes.includes('image-generation'))).toBe(true)

    // eslint-disable-next-line no-console
    console.log(
      `[live] text-capable=${text.length} image-capable=${multimodal.length}; sample=${multimodal
        .slice(0, 3)
        .map((m) => m.id)
        .join(', ')}`
    )
  }, 60_000)

  it('keeps the dedicated capabilities separate from chat', async () => {
    const embedding = filterModels(
      parseCatalogResponse(await client.listModels(credential(), 'embedding')),
      { capability: 'embedding' }
    )
    expect(embedding.length).toBeGreaterThan(0)
    expect(embedding.every((m) => m.endpointTypes.includes('embeddings'))).toBe(true)
    // eslint-disable-next-line no-console
    console.log(`[live] embedding models: ${embedding.map((m) => m.id).join(', ')}`)
  }, 60_000)

  it('returns the verified seed when discovery is unavailable', () => {
    expect(seedFor({ capability: 'chat' }).length).toBeGreaterThan(0)
    expect(seedFor({ capability: 'chat', modality: 'image' }).length).toBeGreaterThan(0)
  })
})

live('orcarouter live inference (through the shipped provider path)', () => {
  it('completes a real chat request against api.orcarouter.ai/v1', async () => {
    const origins = resolveOrigins()
    const client = new OrcaClient(origins)
    const models = filterModels(
      parseCatalogResponse(await client.listModels(credential(), 'chat')),
      {
        capability: 'chat'
      }
    )
    // Prefer the routing alias so the check does not depend on one vendor.
    const preferred = models.find((m) => m.id === 'orcarouter/auto') ?? models[0]

    const result = await client.chat(credential(), {
      model: preferred.id,
      messages: [{ role: 'user', content: 'Reply with the single word: pong' }]
    })

    expect(typeof result.content).toBe('string')
    expect(result.content.length).toBeGreaterThan(0)
    // eslint-disable-next-line no-console
    console.log(
      `[live] inference ok: requested=${preferred.id} served=${result.model} chars=${result.content.length}`
    )
  }, 120_000)

  it('rejects a revoked/invalid key with a terminal error, not a retry loop', async () => {
    const origins = resolveOrigins()
    const client = new OrcaClient(origins)
    const fake: OrcaCredential = {
      key: 'sk-orca-invalid00000000000000000000000000',
      source: 'apiKey',
      accountId: 'fp_invalid',
      generation: 1
    }
    await expect(client.listModels(fake, 'chat')).rejects.toThrow()
  }, 60_000)
})
