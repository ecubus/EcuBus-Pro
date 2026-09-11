import { describe, expect, it } from 'vitest'
import {
  base64UrlEncode,
  createAttempt,
  createChallenge,
  createState,
  createVerifier,
  stateMatches
} from '../../src/main/orcarouter/pkce'

describe('orcarouter pkce primitives', () => {
  it('produces an unpadded base64url verifier from a crypto RNG', () => {
    const verifier = createVerifier()
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(verifier).not.toContain('=')
    expect(verifier).not.toContain('+')
    expect(verifier).not.toContain('/')
    // 32 random bytes -> 43 base64url characters, the RFC 7636 upper bound.
    expect(verifier.length).toBe(43)
  })

  it('uses a fresh verifier and state for every attempt', () => {
    const attempts = Array.from({ length: 64 }, () => createAttempt())
    expect(new Set(attempts.map((a) => a.verifier)).size).toBe(attempts.length)
    expect(new Set(attempts.map((a) => a.state)).size).toBe(attempts.length)
  })

  it('derives the challenge as unspecified-padding base64url(sha256(verifier))', () => {
    // RFC 7636 appendix B test vector.
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    expect(createChallenge(verifier)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('never emits padding or url-unsafe characters in a challenge', () => {
    for (let i = 0; i < 200; i += 1) {
      const challenge = createChallenge(createVerifier())
      expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/)
    }
  })

  it('generates an opaque 22-character state', () => {
    const state = createState()
    expect(state).toMatch(/^[A-Za-z0-9_-]{22}$/)
  })

  it('compares state in constant time and rejects mismatches', () => {
    const state = createState()
    expect(stateMatches(state, state)).toBe(true)
    expect(stateMatches(state, `${state}x`)).toBe(false)
    expect(stateMatches(state, state.slice(0, -1))).toBe(false)
    expect(stateMatches(state, null)).toBe(false)
    expect(stateMatches(state, undefined)).toBe(false)
    expect(stateMatches(state, '')).toBe(false)
  })

  it('encodes bytes without padding', () => {
    expect(base64UrlEncode(Buffer.from([0xff, 0xef, 0xfe]))).toBe('_-_-')
  })
})
