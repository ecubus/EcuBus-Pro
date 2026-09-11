import { describe, expect, it } from 'vitest'
import {
  AUTHORIZE_PATH,
  CHAT_COMPLETIONS_PATH,
  DEFAULT_API_BASE,
  DEFAULT_AUTH_BASE,
  EXCHANGE_PATH,
  MODELS_PATH,
  buildAuthorizeUrl,
  buildChatCompletionsUrl,
  buildExchangeUrl,
  buildModelsUrl,
  resolveOrigins
} from '../../src/main/orcarouter/origins'

describe('orcarouter origins', () => {
  it('defaults auth to www and inference to api', () => {
    const origins = resolveOrigins({})
    expect(origins.authBase).toBe('https://www.orcarouter.ai')
    expect(origins.apiBase).toBe('https://api.orcarouter.ai')
    expect(DEFAULT_AUTH_BASE).toBe('https://www.orcarouter.ai')
    expect(DEFAULT_API_BASE).toBe('https://api.orcarouter.ai')
  })

  it('never derives one origin from the other', () => {
    const origins = resolveOrigins({})
    expect(origins.apiBase).not.toContain('www.')
    expect(origins.authBase).not.toContain('api.')
  })

  it('puts the exchange on the auth origin and the /v1 paths on the api origin', () => {
    const origins = resolveOrigins({})
    expect(buildExchangeUrl(origins.authBase)).toBe('https://www.orcarouter.ai/api/v1/auth/keys')
    expect(buildExchangeUrl(origins.authBase)).not.toContain('api.orcarouter.ai')
    expect(buildModelsUrl(origins.apiBase)).toBe('https://api.orcarouter.ai/v1/models')
    expect(buildChatCompletionsUrl(origins.apiBase)).toBe(
      'https://api.orcarouter.ai/v1/chat/completions'
    )
    expect(AUTHORIZE_PATH).toBe('/auth')
    expect(EXCHANGE_PATH).toBe('/api/v1/auth/keys')
    expect(MODELS_PATH).toBe('/v1/models')
    expect(CHAT_COMPLETIONS_PATH).toBe('/v1/chat/completions')
  })

  it('does not produce the documented 404 path', () => {
    const origins = resolveOrigins({})
    // The relay is at /v1; auth endpoints are not. This must never be built.
    expect(buildExchangeUrl(origins.authBase)).not.toBe('https://api.orcarouter.ai/v1/auth/keys')
    expect(buildExchangeUrl(origins.apiBase)).not.toBe('https://api.orcarouter.ai/v1/auth/keys')
  })

  it('prefers explicit overrides over the shared self-hosted base', () => {
    const origins = resolveOrigins({
      ORCA_BASE_URL: 'https://orca.internal',
      ORCA_AUTH_BASE_URL: 'https://auth.internal',
      ORCA_API_BASE_URL: 'https://infer.internal'
    })
    expect(origins.authBase).toBe('https://auth.internal')
    expect(origins.apiBase).toBe('https://infer.internal')
  })

  it('falls back to the shared base for whichever override is absent', () => {
    const onlyAuth = resolveOrigins({
      ORCA_BASE_URL: 'https://orca.internal',
      ORCA_AUTH_BASE_URL: 'https://auth.internal'
    })
    expect(onlyAuth.authBase).toBe('https://auth.internal')
    expect(onlyAuth.apiBase).toBe('https://orca.internal')

    const onlyApi = resolveOrigins({
      ORCA_BASE_URL: 'https://orca.internal',
      ORCA_API_BASE_URL: 'https://infer.internal'
    })
    expect(onlyApi.authBase).toBe('https://orca.internal')
    expect(onlyApi.apiBase).toBe('https://infer.internal')
  })

  it('accepts a one-origin self-hosted deployment through the shared fallback', () => {
    const origins = resolveOrigins({ ORCA_BASE_URL: 'https://orca.example.com' })
    expect(origins.authBase).toBe('https://orca.example.com')
    expect(origins.apiBase).toBe('https://orca.example.com')
  })

  it('strips trailing slashes so paths do not double up', () => {
    const origins = resolveOrigins({ ORCA_BASE_URL: 'https://orca.internal/' })
    expect(buildModelsUrl(origins.apiBase)).toBe('https://orca.internal/v1/models')
  })

  it('requires HTTPS for remote origins', () => {
    expect(() => resolveOrigins({ ORCA_BASE_URL: 'http://orca.example.com' })).toThrow(/HTTPS/)
    expect(() => resolveOrigins({ ORCA_AUTH_BASE_URL: 'http://evil.example.com' })).toThrow(/HTTPS/)
  })

  it('permits plain HTTP only for loopback development', () => {
    expect(resolveOrigins({ ORCA_BASE_URL: 'http://127.0.0.1:8080' }).authBase).toBe(
      'http://127.0.0.1:8080'
    )
    expect(resolveOrigins({ ORCA_BASE_URL: 'http://localhost:8080' }).apiBase).toBe(
      'http://localhost:8080'
    )
  })

  it('rejects a malformed base URL', () => {
    expect(() => resolveOrigins({ ORCA_BASE_URL: 'not-a-url' })).toThrow(/valid URL/)
  })
})

describe('orcarouter authorize url', () => {
  const params = {
    callbackUrl: 'http://127.0.0.1:51733/cb',
    codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    state: 'opaque-state',
    appName: 'EcuBus-Pro'
  }

  it('uses the loopback callback, S256 and the default api scope', () => {
    const url = new URL(buildAuthorizeUrl('https://www.orcarouter.ai', params))
    expect(url.origin).toBe('https://www.orcarouter.ai')
    expect(url.pathname).toBe('/auth')
    expect(url.searchParams.get('callback_url')).toBe('http://127.0.0.1:51733/cb')
    expect(url.searchParams.get('code_challenge')).toBe(params.codeChallenge)
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('state')).toBe('opaque-state')
    expect(url.searchParams.get('app_name')).toBe('EcuBus-Pro')
    expect(url.searchParams.get('scope')).toBe('api')
  })

  it('never carries the verifier', () => {
    const url = buildAuthorizeUrl('https://www.orcarouter.ai', params)
    expect(url).not.toContain('code_verifier')
    expect(url).not.toContain('verifier')
  })

  it('always sends S256, never plain', () => {
    const url = buildAuthorizeUrl('https://www.orcarouter.ai', params)
    expect(url).toContain('code_challenge_method=S256')
    expect(url).not.toContain('plain')
  })
})
