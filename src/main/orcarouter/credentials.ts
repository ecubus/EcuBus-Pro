/**
 * OrcaRouter credential seam.
 *
 * Both user-facing authentication methods — pasting an `sk-orca-…` API key and
 * signing in with an OrcaRouter account over OAuth 2.0 + PKCE — are adapters on
 * one small interface. They produce the same value type, and nothing downstream
 * (inference, model discovery, status UI) is allowed to care which adapter the
 * credential came from.
 *
 * This module deliberately imports nothing from Electron so it can be unit
 * tested directly; the OS-keychain-backed vault lives in `secretStorage.ts`.
 *
 * @module orcarouter/credentials
 */

import { createHash } from 'node:crypto'

/** How a credential was obtained. Display/telemetry only — never a request input. */
export type OrcaCredentialSource = 'apiKey' | 'pkce'

/** Lightweight shape check only: a prefix is not proof that a key is valid. */
export const ORCA_KEY_PREFIX = 'sk-orca-'

export interface AcquiredCredential {
  key: string
  source: OrcaCredentialSource
  /** Granted scope, read back from the exchange response. */
  scope?: string
  /** Stable, non-secret account identity. A fingerprint when no id was issued. */
  accountId: string
}

export interface OrcaCredential extends AcquiredCredential {
  /** Monotonic per-store counter. Bumped on every successful replacement. */
  generation: number
}

/** Credential lifecycle state surfaced to the UI. */
export type OrcaAuthStatus = 'none' | 'configured' | 'needsReauth'

export interface OrcaStatus {
  status: OrcaAuthStatus
  source?: OrcaCredentialSource
  accountId?: string
  generation: number
  scope?: string
}

/** Where a secret is persisted. Implemented by safeStorage in the main process. */
export interface OrcaSecretVault {
  read(): Promise<string | null>
  write(payload: string): Promise<void>
  clear(): Promise<void>
}

/** One authentication method. The only thing a UI has to know about it. */
export interface CredentialAdapter {
  readonly source: OrcaCredentialSource
  /** Display label, resolved by the caller through i18n. */
  readonly labelKey: string
  acquire(): Promise<AcquiredCredential>
}

/**
 * Stable, non-reversible account identity for a key that was pasted rather than
 * issued to us. Only a truncated SHA-256 digest is kept — never the key.
 */
export function fingerprintKey(key: string): string {
  return `fp_${createHash('sha256').update(key, 'utf8').digest('hex').slice(0, 16)}`
}

/** Replace anything key-shaped with a placeholder. Safe for logs and errors. */
export function redactSecrets(input: string): string {
  return input
    .replace(/sk-orca-[A-Za-z0-9._-]+/g, `${ORCA_KEY_PREFIX}***`)
    .replace(/(code_verifier|code|state|device_code)"?\s*[:=]\s*"?[A-Za-z0-9._~-]{8,}/gi, '$1=***')
}

/** Keep provider metadata (status codes, error codes) and drop free-form bodies. */
export function safeErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error)
  return redactSecrets(raw)
}

/** Thrown when a key does not even look like an OrcaRouter key. */
export class InvalidKeyFormatError extends Error {
  constructor() {
    super(`OrcaRouter API keys start with "${ORCA_KEY_PREFIX}"`)
    this.name = 'InvalidKeyFormatError'
  }
}

/** Thrown when the relay rejects the stored credential. Terminal, not retryable. */
export class CredentialRejectedError extends Error {
  constructor(
    public readonly accountId: string,
    public readonly generation: number
  ) {
    super('OrcaRouter rejected this credential; sign in again to continue')
    this.name = 'CredentialRejectedError'
  }
}

function requireKeyShape(key: string): string {
  const trimmed = key.trim()
  if (!trimmed.startsWith(ORCA_KEY_PREFIX) || trimmed.length <= ORCA_KEY_PREFIX.length) {
    throw new InvalidKeyFormatError()
  }
  return trimmed
}

/**
 * Adapter 1 — an API key the user already holds. Works with no browser and no
 * account login, which keeps this path usable on locked-down machines.
 */
export class ApiKeyAdapter implements CredentialAdapter {
  readonly source: OrcaCredentialSource = 'apiKey'
  readonly labelKey = 'ai.orcaAuthMethodApiKey'

  /**
   * @param readKey Supplies the key from wherever the host already asks for it
   *   (settings form, environment, existing secret store). Never logged.
   */
  constructor(private readonly readKey: () => Promise<string | undefined | null>) {}

  async acquire(): Promise<AcquiredCredential> {
    const raw = await this.readKey()
    if (!raw) throw new InvalidKeyFormatError()
    const key = requireKeyShape(raw)
    // `scope` is present on both adapters so downstream code sees one shape.
    return { key, source: this.source, scope: undefined, accountId: fingerprintKey(key) }
  }
}

/**
 * Adapter 2 — "Connect with OrcaRouter". The PKCE flow itself is injected so
 * the adapter stays free of browser, socket and UI concerns, and so tests can
 * drive it with a local fake authorization server.
 *
 * The returned key is a durable API key, **not** a refresh token: there is no
 * refresh grant to call later.
 */
export class PkceAdapter implements CredentialAdapter {
  readonly source: OrcaCredentialSource = 'pkce'
  readonly labelKey = 'ai.orcaAuthMethodPkce'

  constructor(
    private readonly authorize: () => Promise<{ key: string; userId?: string; scope?: string }>
  ) {}

  async acquire(): Promise<AcquiredCredential> {
    const result = await this.authorize()
    const key = requireKeyShape(result.key)
    return {
      key,
      source: this.source,
      scope: result.scope,
      accountId: result.userId ? `uid_${result.userId}` : fingerprintKey(key)
    }
  }
}

/**
 * Holds the active credential, its generation, and the terminal-rejection
 * state for the exact account/generation pair that made the rejected request.
 */
export class OrcaCredentialStore {
  private credential: OrcaCredential | null = null
  private generation = 0
  private rejected: { accountId: string; generation: number } | null = null
  private listeners = new Set<(status: OrcaStatus) => void>()

  /** Adopt a credential from either adapter, stamped with a new generation. */
  commit(acquired: AcquiredCredential): OrcaCredential {
    this.generation += 1
    const next: OrcaCredential = {
      ...acquired,
      key: requireKeyShape(acquired.key),
      generation: this.generation
    }
    // Only now is the previous credential replaced, and the rejection flag for
    // it is dropped together with it.
    this.credential = next
    this.rejected = null
    this.emit()
    return next
  }

  getCredential(): OrcaCredential | null {
    return this.credential
  }

  getGeneration(): number {
    return this.generation
  }

  getStatus(): OrcaStatus {
    if (!this.credential) return { status: 'none', generation: this.generation }
    const isRejected =
      this.rejected !== null &&
      this.rejected.accountId === this.credential.accountId &&
      this.rejected.generation === this.credential.generation
    return {
      status: isRejected ? 'needsReauth' : 'configured',
      source: this.credential.source,
      accountId: this.credential.accountId,
      scope: this.credential.scope,
      generation: this.credential.generation
    }
  }

  /** Drop the in-memory credential. The stored secret is cleared by the caller. */
  clear(): void {
    this.credential = null
    this.rejected = null
    this.emit()
  }

  /**
   * Mark the credential that made a rejected request as needing reauthentication.
   *
   * Only the exact account **and** generation is affected: a response that
   * arrives late, after the user has already signed in again, leaves the new
   * credential untouched. Returns whether the flag was applied.
   */
  markNeedsReauth(accountId: string, generation: number): boolean {
    const current = this.credential
    if (!current) return false
    if (current.accountId !== accountId || current.generation !== generation) return false
    this.rejected = { accountId, generation }
    this.emit()
    return true
  }

  /** Resolve a request that was issued against a specific credential. */
  credentialForRequest(): { credential: OrcaCredential; accountId: string; generation: number } {
    if (!this.credential) throw new Error('OrcaRouter is not authenticated')
    return {
      credential: this.credential,
      accountId: this.credential.accountId,
      generation: this.credential.generation
    }
  }

  subscribe(listener: (status: OrcaStatus) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    const status = this.getStatus()
    for (const listener of this.listeners) listener(status)
  }
}
