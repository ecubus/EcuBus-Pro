/**
 * PKCE primitives for the OrcaRouter connect flow.
 *
 * The verifier is fresh cryptographic randomness per attempt and never leaves
 * this process before the exchange — it is never placed in a URL, a log line,
 * an error message or telemetry. Only the S256 challenge travels on the
 * authorize URL.
 *
 * @module orcarouter/pkce
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/** base64url without padding, as required for `code_challenge`. */
export function base64UrlEncode(raw: Buffer): string {
  return raw.toString('base64url')
}

/**
 * A new high-entropy verifier. 32 random bytes → 43 base64url characters, which
 * is at the upper end of the RFC 7636 range.
 */
export function createVerifier(): string {
  return base64UrlEncode(randomBytes(32))
}

/** `base64url(sha256(verifier))`, unpadded. */
export function createChallenge(verifier: string): string {
  return base64UrlEncode(createHash('sha256').update(verifier).digest())
}

/** Opaque CSRF token echoed back by the consent screen. */
export function createState(): string {
  return base64UrlEncode(randomBytes(16))
}

/**
 * Constant-time state comparison. Length differences are folded into the result
 * instead of short-circuiting, so the comparison does not leak the state length.
 */
export function stateMatches(expected: string, received: string | null | undefined): boolean {
  if (typeof received !== 'string') return false
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(received, 'utf8')
  if (a.length !== b.length) {
    // Still touch both buffers so the timing profile stays flat.
    timingSafeEqual(a, a)
    return false
  }
  return timingSafeEqual(a, b)
}

/** A verifier/challenge/state triple for exactly one authorization attempt. */
export interface PkceAttempt {
  verifier: string
  challenge: string
  state: string
}

/** Build a fresh attempt. Called once per connect, never reused. */
export function createAttempt(): PkceAttempt {
  const verifier = createVerifier()
  return { verifier, challenge: createChallenge(verifier), state: createState() }
}
