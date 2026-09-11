/**
 * OrcaRouter origin and URL policy.
 *
 * Authentication and inference live on two different public origins:
 *
 * - auth / code exchange : `https://www.orcarouter.ai`
 * - inference / catalog  : `https://api.orcarouter.ai/v1`
 *
 * The two are never derived from each other. `https://api.orcarouter.ai/v1/auth/keys`
 * is a 404 and is deliberately not reachable through this module: the exchange
 * path is only ever appended to an auth origin.
 *
 * @module orcarouter/origins
 */

/** Public default for authentication and code exchange. */
export const DEFAULT_AUTH_BASE = 'https://www.orcarouter.ai'

/** Public default for inference and model discovery (already includes `/v1`). */
export const DEFAULT_API_BASE = 'https://api.orcarouter.ai'

/** Authorize (consent) path, fixed by the protocol. */
export const AUTHORIZE_PATH = '/auth'

/** Code exchange path, fixed by the protocol. */
export const EXCHANGE_PATH = '/api/v1/auth/keys'

/** Model catalog path, relative to the API base. */
export const MODELS_PATH = '/v1/models'

/** Chat completions path, relative to the API base. */
export const CHAT_COMPLETIONS_PATH = '/v1/chat/completions'

/** Key management / revocation dashboard, shown to the user. */
export const CONSOLE_AUTHORIZED_APPS_URL = 'https://www.orcarouter.ai/console/authorized-apps'

export interface OrcaOrigins {
  /** Origin that serves `/auth` and `/api/v1/auth/keys`. Never used for inference. */
  authBase: string
  /** Origin that serves `/v1/...`. Never used for authentication. */
  apiBase: string
}

export interface OriginEnv {
  ORCA_BASE_URL?: string
  ORCA_AUTH_BASE_URL?: string
  ORCA_API_BASE_URL?: string
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/** True when the URL points at the local machine over any scheme. */
export function isLoopback(url: URL): boolean {
  return LOOPBACK_HOSTS.has(url.hostname.toLowerCase())
}

/**
 * Remote origins must be HTTPS. Plain HTTP is tolerated only for loopback
 * development, which is the same rule the protocol applies to `callback_url`.
 */
export function assertOriginAllowed(base: string, label: string): string {
  let url: URL
  try {
    url = new URL(base)
  } catch {
    throw new Error(`OrcaRouter ${label} is not a valid URL`)
  }
  if (url.protocol === 'https:') return stripTrailingSlash(base)
  if (url.protocol === 'http:' && isLoopback(url)) return stripTrailingSlash(base)
  throw new Error(
    `OrcaRouter ${label} must use HTTPS for non-loopback hosts (received ${url.protocol}//${url.host})`
  )
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

/**
 * Resolve both origins. Explicit per-purpose overrides win; `ORCA_BASE_URL` is
 * the shared self-hosted fallback used only where an explicit value is absent.
 */
export function resolveOrigins(env: OriginEnv = process.env as OriginEnv): OrcaOrigins {
  const shared = env.ORCA_BASE_URL ? stripTrailingSlash(env.ORCA_BASE_URL) : undefined
  const authBase = env.ORCA_AUTH_BASE_URL || shared || DEFAULT_AUTH_BASE
  const apiBase = env.ORCA_API_BASE_URL || shared || DEFAULT_API_BASE
  return {
    authBase: assertOriginAllowed(authBase, 'auth base URL'),
    apiBase: assertOriginAllowed(apiBase, 'API base URL')
  }
}

/**
 * Build the authorize URL. `code_challenge` is always S256 — the consent screen
 * lets the user choose "show me a code" even on a loopback flow, so the weaker
 * `plain` method is never acceptable.
 */
export function buildAuthorizeUrl(
  authBase: string,
  params: {
    callbackUrl: string
    codeChallenge: string
    state: string
    appName: string
    scope?: string
  }
): string {
  const url = new URL(AUTHORIZE_PATH, ensureBase(authBase))
  url.searchParams.set('callback_url', params.callbackUrl)
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', params.state)
  url.searchParams.set('app_name', params.appName)
  url.searchParams.set('scope', params.scope ?? 'api')
  return url.toString()
}

/** Exchange endpoint for an auth code. Always on the auth origin. */
export function buildExchangeUrl(authBase: string): string {
  return new URL(EXCHANGE_PATH, ensureBase(authBase)).toString()
}

/** Model catalog endpoint. Always on the API origin, under `/v1`. */
export function buildModelsUrl(apiBase: string, capability?: string): string {
  const url = new URL(MODELS_PATH, ensureBase(apiBase))
  if (capability) url.searchParams.set('capability', capability)
  return url.toString()
}

/** Chat completions endpoint. Always on the API origin, under `/v1`. */
export function buildChatCompletionsUrl(apiBase: string): string {
  return new URL(CHAT_COMPLETIONS_PATH, ensureBase(apiBase)).toString()
}

function ensureBase(base: string): string {
  return base.endsWith('/') ? base : `${base}/`
}
