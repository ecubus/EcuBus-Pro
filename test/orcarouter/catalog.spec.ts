import { describe, expect, it } from 'vitest'
import {
  CATALOG_LIMITS,
  VERIFIED_FALLBACK_SEED,
  filterModels,
  isModelSelectable,
  matchesCapability,
  mergeWithSeed,
  normalizeModel,
  parseCatalogResponse,
  seedFor,
  supportsInputModality
} from '../../src/main/orcarouter/catalog'

/** Fixtures mirroring the shapes the real `/v1/models` endpoint returns. */
const TEXT_ONLY = {
  id: 'deepseek/deepseek-v4-pro',
  object: 'model',
  supported_endpoint_types: ['openai'],
  context_length: 200000,
  architecture: { input_modalities: ['text'], output_modalities: ['text'] }
}

const IMAGE_INPUT_CHAT = {
  id: 'anthropic/claude-opus-4.8',
  object: 'model',
  supported_endpoint_types: ['anthropic', 'openai'],
  context_length: 1000000,
  architecture: { input_modalities: ['text', 'image', 'file'], output_modalities: ['text'] }
}

const EMBEDDING = {
  id: 'openai/text-embedding-3-large',
  object: 'model',
  supported_endpoint_types: ['embeddings'],
  architecture: { input_modalities: ['text'], output_modalities: undefined }
}

const IMAGE_GENERATION = {
  id: 'openai/gpt-image-1',
  object: 'model',
  supported_endpoint_types: ['image-generation'],
  architecture: { input_modalities: ['text', 'image'], output_modalities: undefined }
}

const VIDEO = { id: 'vendor/video-1', supported_endpoint_types: ['openai-video'] }
const RERANK = { id: 'jina/jina-reranker-v3', supported_endpoint_types: ['jina-rerank'] }
/** A chat record that declares no input modalities at all. */
const UNDECLARED_MODALITIES = {
  id: 'openai/gpt-oss-120b',
  supported_endpoint_types: ['openai']
}
/** A record with no endpoint types — observed live on the chat capability. */
const NO_ENDPOINT_TYPES = { id: 'gpt-image-2', supported_endpoint_types: null }

const ALL = [
  TEXT_ONLY,
  IMAGE_INPUT_CHAT,
  EMBEDDING,
  IMAGE_GENERATION,
  VIDEO,
  RERANK,
  UNDECLARED_MODALITIES,
  NO_ENDPOINT_TYPES
]

describe('orcarouter catalog parsing', () => {
  it('accepts the OpenAI envelope and a bare array', () => {
    expect(parseCatalogResponse({ data: [TEXT_ONLY] })).toHaveLength(1)
    expect(parseCatalogResponse([TEXT_ONLY])).toHaveLength(1)
  })

  it('preserves the vendor/model namespace verbatim', () => {
    const [model] = parseCatalogResponse({ data: [IMAGE_INPUT_CHAT] })
    expect(model.id).toBe('anthropic/claude-opus-4.8')
  })

  it('keeps context window and input modalities', () => {
    const [model] = parseCatalogResponse({ data: [IMAGE_INPUT_CHAT] })
    expect(model.contextLength).toBe(1000000)
    expect(model.inputModalities).toEqual(['text', 'image', 'file'])
  })

  it('drops malformed records instead of inventing capabilities', () => {
    expect(normalizeModel(null)).toBeNull()
    expect(normalizeModel('a string')).toBeNull()
    expect(normalizeModel({})).toBeNull()
    expect(normalizeModel({ id: '' })).toBeNull()
    expect(normalizeModel({ id: 42 })).toBeNull()
    expect(normalizeModel({ id: 'x'.repeat(CATALOG_LIMITS.maxIdLength + 1) })).toBeNull()
  })

  it('de-duplicates by id and enforces the item cap', () => {
    const dupes = parseCatalogResponse({ data: [TEXT_ONLY, TEXT_ONLY, IMAGE_INPUT_CHAT] })
    expect(dupes.map((m) => m.id)).toEqual([
      'deepseek/deepseek-v4-pro',
      'anthropic/claude-opus-4.8'
    ])
    const many = Array.from({ length: CATALOG_LIMITS.maxItems + 50 }, (_, i) => ({
      id: `vendor/m${i}`,
      supported_endpoint_types: ['openai']
    }))
    expect(parseCatalogResponse({ data: many }).length).toBe(CATALOG_LIMITS.maxItems)
  })

  it('drops endpoint types this client cannot speak', () => {
    const [model] = parseCatalogResponse({
      data: [{ id: 'v/m', supported_endpoint_types: ['openai', 'some-future-protocol'] }]
    })
    expect(model.endpointTypes).toEqual(['openai'])
  })

  it('returns an empty list for a non-catalog payload', () => {
    expect(parseCatalogResponse(undefined)).toEqual([])
    expect(parseCatalogResponse({ error: 'nope' })).toEqual([])
  })
})

describe('orcarouter capability filtering', () => {
  const models = parseCatalogResponse({ data: ALL })

  it('keeps chat models on the openai/anthropic/gemini/openai-response endpoints', () => {
    const ids = filterModels(models, { capability: 'chat' }).map((m) => m.id)
    expect(ids).toContain('anthropic/claude-opus-4.8')
    expect(ids).toContain('deepseek/deepseek-v4-pro')
    expect(ids).toContain('openai/gpt-oss-120b')
    expect(ids).not.toContain('openai/text-embedding-3-large')
    expect(ids).not.toContain('openai/gpt-image-1')
    expect(ids).not.toContain('vendor/video-1')
    expect(ids).not.toContain('jina/jina-reranker-v3')
  })

  it('excludes a record with no declared endpoint types from every list', () => {
    for (const capability of ['chat', 'embedding', 'image', 'video', 'rerank'] as const) {
      expect(filterModels(models, { capability }).map((m) => m.id)).not.toContain('gpt-image-2')
    }
  })

  it('fails closed on an undeclared input modality for multimodal chat', () => {
    const ids = filterModels(models, { capability: 'chat', modality: 'image' }).map((m) => m.id)
    expect(ids).toEqual(['anthropic/claude-opus-4.8'])
    // The text-only and modality-undeclared chat models must not appear.
    expect(ids).not.toContain('deepseek/deepseek-v4-pro')
    expect(ids).not.toContain('openai/gpt-oss-120b')
  })

  it('does not treat an image-generation model as multimodal chat', () => {
    const ids = filterModels(models, { capability: 'chat', modality: 'image' }).map((m) => m.id)
    expect(ids).not.toContain('openai/gpt-image-1')
  })

  it('selects dedicated capabilities strictly by endpoint type', () => {
    expect(filterModels(models, { capability: 'embedding' }).map((m) => m.id)).toEqual([
      'openai/text-embedding-3-large'
    ])
    expect(filterModels(models, { capability: 'image' }).map((m) => m.id)).toEqual([
      'openai/gpt-image-1'
    ])
    expect(filterModels(models, { capability: 'video' }).map((m) => m.id)).toEqual([
      'vendor/video-1'
    ])
    expect(filterModels(models, { capability: 'rerank' }).map((m) => m.id)).toEqual([
      'jina/jina-reranker-v3'
    ])
  })

  it('reports the empty catalog for a capability with no models', () => {
    expect(filterModels(models, { capability: 'video', modality: 'video' })).toHaveLength(1)
    expect(filterModels([], { capability: 'chat' })).toEqual([])
  })

  it('matches capabilities without guessing from the model name', () => {
    const [embedding] = parseCatalogResponse({ data: [EMBEDDING] })
    // A name that looks like a chat model but declares only `embeddings`.
    expect(matchesCapability(embedding, 'embedding')).toBe(true)
    expect(matchesCapability(embedding, 'chat')).toBe(false)
    expect(matchesCapability({ ...embedding, id: 'openai/gpt-4o' }, 'chat')).toBe(false)
  })

  it('treats text as always available but other modalities as declared-only', () => {
    const [model] = parseCatalogResponse({ data: [IMAGE_INPUT_CHAT] })
    expect(supportsInputModality(model, 'text')).toBe(true)
    expect(supportsInputModality(model, 'image')).toBe(true)
    expect(supportsInputModality(model, 'audio')).toBe(false)
    expect(supportsInputModality(model, 'video')).toBe(false)
  })
})

describe('orcarouter verified fallback seed', () => {
  it('contains exactly the verified seed ids', () => {
    expect(VERIFIED_FALLBACK_SEED.map((m) => m.id)).toEqual([
      'openai/gpt-5.5',
      'anthropic/claude-opus-4.8',
      'google/gemini-3.5-flash',
      'deepseek/deepseek-v4-pro',
      'orcarouter/auto'
    ])
  })

  it('keeps the verified reasoning effort ladder on gpt-5.5', () => {
    const gpt = VERIFIED_FALLBACK_SEED.find((m) => m.id === 'openai/gpt-5.5')
    expect(gpt?.reasoning).toBe(true)
    expect(gpt?.reasoningEfforts).toEqual(['low', 'medium', 'high', 'xhigh'])
  })

  it('keeps input-modality metadata on the seed', () => {
    const deepseek = VERIFIED_FALLBACK_SEED.find((m) => m.id === 'deepseek/deepseek-v4-pro')
    expect(deepseek?.inputModalities).toEqual(['text'])
    const opus = VERIFIED_FALLBACK_SEED.find((m) => m.id === 'anthropic/claude-opus-4.8')
    expect(opus?.inputModalities).toContain('image')
  })

  it('filters the seed for the requested entry point', () => {
    expect(seedFor({ capability: 'chat' }).length).toBe(5)
    expect(seedFor({ capability: 'embedding' })).toEqual([])
    expect(seedFor({ capability: 'image' })).toEqual([])
    expect(seedFor({ capability: 'chat', modality: 'image' }).map((m) => m.id)).toEqual([
      'openai/gpt-5.5',
      'anthropic/claude-opus-4.8',
      'google/gemini-3.5-flash',
      'orcarouter/auto'
    ])
    expect(seedFor({ capability: 'chat', modality: 'image' }).map((m) => m.id)).not.toContain(
      'deepseek/deepseek-v4-pro'
    )
  })

  it('never dilutes an authoritative live list with the seed', () => {
    const live = parseCatalogResponse({ data: [TEXT_ONLY] })
    const merged = mergeWithSeed(live)
    expect(merged.map((m) => m.id)).toEqual(['deepseek/deepseek-v4-pro'])
    expect(merged.map((m) => m.id)).not.toContain('orcarouter/auto')
  })

  it('uses the seed only when live discovery produced nothing', () => {
    expect(mergeWithSeed([]).map((m) => m.id)).toEqual(VERIFIED_FALLBACK_SEED.map((m) => m.id))
  })
})

describe('orcarouter stale selection handling', () => {
  const models = parseCatalogResponse({ data: ALL })

  it('keeps a still-compatible model selected', () => {
    expect(isModelSelectable(models, 'anthropic/claude-opus-4.8')).toBe(true)
  })

  it('invalidates a model that dropped out of the filtered list', () => {
    const multimodal = filterModels(models, { capability: 'chat', modality: 'image' })
    expect(isModelSelectable(multimodal, 'deepseek/deepseek-v4-pro')).toBe(false)
    expect(isModelSelectable(multimodal, 'anthropic/claude-opus-4.8')).toBe(true)
  })

  it('treats an absent selection as not selectable', () => {
    expect(isModelSelectable(models, undefined)).toBe(false)
    expect(isModelSelectable(models, '')).toBe(false)
    expect(isModelSelectable(models, 'nope/nope')).toBe(false)
  })
})
