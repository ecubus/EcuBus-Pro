/**
 * Bounded model discovery for OrcaRouter.
 *
 * `GET /v1/models` under the configured API origin is the only source of truth
 * for what a workspace can call. When it is unavailable the caller gets the
 * small, verified seed instead — clearly labelled `degraded` — never a free
 * text field and never an unverified example list.
 *
 * @module orcarouter/discovery
 */

import {
  CATALOG_LIMITS,
  CatalogResult,
  ModelQuery,
  OrcaModel,
  VERIFIED_FALLBACK_SEED,
  filterModels,
  parseCatalogResponse
} from './catalog'

/** Fetches one raw `/v1/models` payload for a capability (or the whole list). */
export type CatalogFetcher = (capability?: string) => Promise<unknown>

export interface DiscoveryOptions {
  /** How long a successful live response stays authoritative. */
  ttlMs?: number
  /** Upper bound on one catalog request. */
  timeoutMs?: number
  /** Injectable clock, so cache behaviour is testable. */
  now?: () => number
}

interface CacheEntry {
  models: OrcaModel[]
  fetchedAt: number
}

/**
 * Caches live catalogs per capability and falls back to the verified seed.
 *
 * Live results are never merged with the seed: when discovery succeeds its
 * answer is authoritative. The seed is only used when there is no live result
 * and no usable cache.
 */
export class ModelDiscovery {
  private readonly cache = new Map<string, CacheEntry>()
  private readonly ttlMs: number
  private readonly timeoutMs: number
  private readonly now: () => number

  constructor(
    private readonly fetcher: CatalogFetcher,
    options: DiscoveryOptions = {},
    private readonly seed: readonly OrcaModel[] = VERIFIED_FALLBACK_SEED
  ) {
    this.ttlMs = options.ttlMs ?? 5 * 60_000
    this.timeoutMs = options.timeoutMs ?? CATALOG_LIMITS.timeoutMs
    this.now = options.now ?? Date.now
  }

  /**
   * Resolve the model list for one entry point.
   *
   * @param force Skip the cache and re-fetch (the UI refresh action).
   */
  async resolve(query: ModelQuery, force = false): Promise<CatalogResult> {
    const cacheKey = query.capability
    const cached = this.cache.get(cacheKey)
    const fresh = cached && this.now() - cached.fetchedAt < this.ttlMs

    if (fresh && !force) {
      return {
        models: filterModels(cached.models, query),
        source: 'cache',
        degraded: false
      }
    }

    try {
      const payload = await this.withTimeout(this.fetcher(query.capability))
      const models = parseCatalogResponse(payload)
      if (models.length > 0) {
        this.cache.set(cacheKey, { models, fetchedAt: this.now() })
        return { models: filterModels(models, query), source: 'live', degraded: false }
      }
      return this.fallback(query, 'OrcaRouter returned an empty model catalog')
    } catch (error) {
      return this.fallback(query, describeDiscoveryError(error))
    }
  }

  /** Last known-good list, even if stale. Used to soften an outage. */
  resolveLastKnownGood(query: ModelQuery): CatalogResult | null {
    const cached = this.cache.get(query.capability)
    if (!cached || cached.models.length === 0) return null
    return {
      models: filterModels(cached.models, query),
      source: 'cache',
      degraded: true,
      reason: 'Live OrcaRouter catalog is unavailable; showing the last known-good list'
    }
  }

  /** Explicitly refresh every capability the UI currently depends on. */
  async refresh(capabilities: string[]): Promise<void> {
    for (const capability of capabilities) {
      await this.resolve({ capability: capability as ModelQuery['capability'] }, true)
    }
  }

  /** Drop all cached catalogs, e.g. after the account changes. */
  clear(): void {
    this.cache.clear()
  }

  private fallback(query: ModelQuery, reason: string): CatalogResult {
    // A stale but real catalog beats the seed; the seed beats an empty selector.
    const lastKnownGood = this.resolveLastKnownGood(query)
    if (lastKnownGood && lastKnownGood.models.length > 0) return lastKnownGood
    return {
      models: filterModels(this.seed, query),
      source: 'seed',
      degraded: true,
      reason
    }
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('OrcaRouter model catalog request timed out')),
        this.timeoutMs
      )
      promise.then(
        (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        (error) => {
          clearTimeout(timer)
          reject(error)
        }
      )
    })
  }
}

/** Short, secret-free reason shown in the degraded badge tooltip. */
export function describeDiscoveryError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/timed out/i.test(message)) return 'OrcaRouter model catalog request timed out'
  if (/401|403/.test(message)) {
    return 'OrcaRouter rejected the credential while loading models'
  }
  return 'Could not reach the OrcaRouter model catalog'
}

/**
 * Response byte cap. Enforced by the transport before the payload is parsed, so
 * a hostile or broken catalog response cannot be buffered without bound.
 */
export function exceedsByteBudget(length: number): boolean {
  return length > CATALOG_LIMITS.maxBytes
}
