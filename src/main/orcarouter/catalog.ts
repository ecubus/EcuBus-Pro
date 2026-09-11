/**
 * OrcaRouter model catalog: live discovery, capability filtering and the
 * verified cold-start fallback.
 *
 * The catalog endpoint is the only source of truth for what a workspace can
 * actually call. Nothing here guesses a capability from a model name: a record
 * that does not explicitly declare the endpoint type (or the input modality)
 * the caller needs is filtered out — fail closed.
 *
 * @module orcarouter/catalog
 */

/** Endpoint types that can serve a text chat / agent turn. */
export const TEXT_ENDPOINT_TYPES = ['openai', 'anthropic', 'gemini', 'openai-response'] as const

/** Endpoint types that are dedicated to a single non-text capability. */
export const EMBEDDING_ENDPOINT_TYPE = 'embeddings'
export const IMAGE_ENDPOINT_TYPE = 'image-generation'
export const VIDEO_ENDPOINT_TYPE = 'openai-video'
export const RERANK_ENDPOINT_TYPE = 'jina-rerank'

/** Every endpoint type this client knows how to speak. Others are dropped. */
const KNOWN_ENDPOINT_TYPES = new Set<string>([
  ...TEXT_ENDPOINT_TYPES,
  EMBEDDING_ENDPOINT_TYPE,
  IMAGE_ENDPOINT_TYPE,
  VIDEO_ENDPOINT_TYPE,
  RERANK_ENDPOINT_TYPE
])

export type OrcaCapability = 'chat' | 'embedding' | 'image' | 'video' | 'rerank'

/**
 * Non-text modalities an entry point may actually upload.
 *
 * `file` is included because the live catalog advertises it alongside `image`
 * (for example `anthropic/claude-fable-5`). Keeping it preserves the metadata
 * the catalog actually publishes instead of silently truncating it.
 */
export type OrcaModality = 'text' | 'image' | 'audio' | 'video' | 'file'

export interface OrcaModel {
  /** Vendor-namespaced id, preserved verbatim (`vendor/model`). */
  id: string
  name?: string
  contextLength?: number
  maxCompletionTokens?: number
  /** `architecture.input_modalities`; empty array when undeclared. */
  inputModalities: OrcaModality[]
  outputModalities: string[]
  /** `supported_endpoint_types`, restricted to types this client can speak. */
  endpointTypes: string[]
  /** Only ever set from a verified source, never inferred from the name. */
  reasoning?: boolean
  reasoningEfforts?: string[]
  ownedBy?: string
}

export interface ModelQuery {
  capability: OrcaCapability
  /**
   * For the multimodal entry points: the non-text modality that will actually
   * be uploaded. Ignored for every capability other than `chat`.
   */
  modality?: OrcaModality
}

/** Where a resolved list came from. `live` is authoritative. */
export type CatalogSource = 'live' | 'cache' | 'seed'

export interface CatalogResult {
  models: OrcaModel[]
  source: CatalogSource
  /** True whenever the list is not the authoritative live catalog. */
  degraded: boolean
  /** Human-readable reason for the degraded state, never containing a key. */
  reason?: string
}

/** Hard bounds so a hostile or broken catalog response cannot exhaust memory. */
export const CATALOG_LIMITS = {
  timeoutMs: 10_000,
  /** 8 MiB — the live catalog is ~150 KiB; this is ~50x headroom. */
  maxBytes: 8 * 1024 * 1024,
  maxItems: 5_000,
  maxIdLength: 200
} as const

/**
 * Response byte cap. Enforced by the transport before the payload is parsed, so
 * a hostile or broken catalog response cannot be buffered without bound.
 */
export function exceedsByteBudget(length: number): boolean {
  return length > CATALOG_LIMITS.maxBytes
}

const MODALITIES = new Set<OrcaModality>(['text', 'image', 'audio', 'video', 'file'])

/**
 * The verified fallback catalog. Used **only** when live discovery fails, and
 * always labelled degraded in the UI. Metadata here is preserved from the
 * verified campaign seed; `openai/gpt-5.5` keeps its reasoning effort ladder.
 */
export const VERIFIED_FALLBACK_SEED: readonly OrcaModel[] = [
  {
    id: 'openai/gpt-5.5',
    name: 'OpenAI: GPT-5.5',
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    endpointTypes: ['openai', 'openai-response'],
    reasoning: true,
    reasoningEfforts: ['low', 'medium', 'high', 'xhigh']
  },
  {
    id: 'anthropic/claude-opus-4.8',
    name: 'Anthropic: Claude Opus 4.8',
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    endpointTypes: ['anthropic', 'openai'],
    reasoning: true
  },
  {
    id: 'google/gemini-3.5-flash',
    name: 'Google: Gemini 3.5 Flash',
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    endpointTypes: ['gemini', 'openai'],
    reasoning: true
  },
  {
    id: 'deepseek/deepseek-v4-pro',
    name: 'DeepSeek: V4 Pro',
    inputModalities: ['text'],
    outputModalities: ['text'],
    endpointTypes: ['openai'],
    reasoning: true
  },
  {
    id: 'orcarouter/auto',
    name: 'OrcaRouter: Auto',
    inputModalities: ['text', 'image'],
    outputModalities: ['text'],
    endpointTypes: ['openai', 'anthropic', 'gemini', 'openai-response']
  }
]

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

function asModalities(value: unknown): OrcaModality[] {
  return asStringArray(value).filter((v): v is OrcaModality => MODALITIES.has(v as OrcaModality))
}

function asPositiveInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined
  return Math.floor(value)
}

/**
 * Normalise one raw catalog record. Returns `null` for anything that is not a
 * usable model — a record without a `supported_endpoint_types` list is dropped
 * rather than assumed to be text, so it can never leak into a selector.
 */
export function normalizeModel(raw: unknown): OrcaModel | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const id = record.id
  if (typeof id !== 'string' || id.length === 0 || id.length > CATALOG_LIMITS.maxIdLength) {
    return null
  }
  const architecture = (record.architecture ?? {}) as Record<string, unknown>
  return {
    id,
    name: typeof record.name === 'string' ? record.name : undefined,
    contextLength: asPositiveInt(record.context_length),
    maxCompletionTokens: asPositiveInt(record.max_completion_tokens),
    inputModalities: asModalities(architecture.input_modalities),
    outputModalities: asStringArray(architecture.output_modalities),
    endpointTypes: asStringArray(record.supported_endpoint_types).filter((t) =>
      KNOWN_ENDPOINT_TYPES.has(t)
    ),
    ownedBy: typeof record.owned_by === 'string' ? record.owned_by : undefined
  }
}

/**
 * Parse a `/v1/models` payload. Accepts the documented OpenAI envelope as well
 * as a bare array, drops malformed records, de-duplicates by id and enforces
 * the item cap.
 */
export function parseCatalogResponse(payload: unknown): OrcaModel[] {
  const rawItems = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as any).data)
      ? (payload as any).data
      : []
  const out: OrcaModel[] = []
  const seen = new Set<string>()
  for (const item of rawItems.slice(0, CATALOG_LIMITS.maxItems)) {
    const model = normalizeModel(item)
    if (!model || seen.has(model.id)) continue
    seen.add(model.id)
    out.push(model)
  }
  return out
}

/** Does this record declare an endpoint type that can serve a text turn? */
export function supportsText(model: OrcaModel): boolean {
  return model.endpointTypes.some((t) => (TEXT_ENDPOINT_TYPES as readonly string[]).includes(t))
}

/** Does this record explicitly declare the given input modality? */
export function supportsInputModality(model: OrcaModel, modality: OrcaModality): boolean {
  if (modality === 'text') return true
  return model.inputModalities.includes(modality)
}

/** Capability predicate. Every branch fails closed on undeclared metadata. */
export function matchesCapability(model: OrcaModel, capability: OrcaCapability): boolean {
  switch (capability) {
    case 'chat':
      return supportsText(model)
    case 'embedding':
      return model.endpointTypes.includes(EMBEDDING_ENDPOINT_TYPE)
    case 'image':
      return model.endpointTypes.includes(IMAGE_ENDPOINT_TYPE)
    case 'video':
      return model.endpointTypes.includes(VIDEO_ENDPOINT_TYPE)
    case 'rerank':
      return model.endpointTypes.includes(RERANK_ENDPOINT_TYPE)
    default:
      return false
  }
}

/**
 * Filter a list for one entry point. A chat entry point that uploads an image
 * requires the record to declare `image` in `architecture.input_modalities`;
 * an undeclared model never reaches a multimodal selector.
 */
export function filterModels(models: readonly OrcaModel[], query: ModelQuery): OrcaModel[] {
  const filtered = models.filter((m) => matchesCapability(m, query.capability))
  if (query.capability !== 'chat' || !query.modality || query.modality === 'text') {
    return filtered
  }
  return filtered.filter((m) => supportsInputModality(m, query.modality as OrcaModality))
}

/** Is this model still in the list a selector is currently allowed to offer? */
export function isModelSelectable(
  models: readonly OrcaModel[],
  modelId: string | undefined | null
): boolean {
  if (!modelId) return false
  return models.some((m) => m.id === modelId)
}

/**
 * Merge freshly discovered models with the verified seed. Live results are
 * authoritative and are returned as-is; the seed never dilutes them.
 */
export function mergeWithSeed(
  live: readonly OrcaModel[],
  seed: readonly OrcaModel[] = VERIFIED_FALLBACK_SEED
): OrcaModel[] {
  if (live.length === 0) return [...seed]
  return [...live]
}

/** Seed list for one entry point, with verified metadata intact. */
export function seedFor(
  query: ModelQuery,
  seed: readonly OrcaModel[] = VERIFIED_FALLBACK_SEED
): OrcaModel[] {
  return filterModels(seed, query)
}
