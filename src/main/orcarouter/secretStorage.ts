/**
 * Secret storage for the OrcaRouter credential.
 *
 * This reuses the two mechanisms the project already trusts — Electron
 * `safeStorage` for encryption at rest and the `conf`-backed `store` for
 * persistence (the same pair `src/main/ipc/casdoor.ts` uses). No new secret
 * store is introduced.
 *
 * @module orcarouter/secretStorage
 */

import { safeStorage } from 'electron'
import log from 'electron-log/main'
import { store } from '../store'

/** `store` key holding the encrypted OrcaRouter credential payload. */
export const ORCA_SECRET_STORE_KEY = 'orcarouter.credential'

/**
 * Persisted payload. It is never a refresh token — OrcaRouter issues a durable
 * API key with no refresh grant, and `refreshable` is a compatibility marker
 * that no code in this module treats as a token lifecycle.
 */
export interface StoredCredential {
  /** Opaque at-rest envelope produced by safeStorage (base64), or plaintext fallback. */
  payload: string
  /** `safeStorage` when available, `plain` when the OS keyring is not. */
  protection: 'safeStorage' | 'plain'
  source: 'apiKey' | 'pkce'
  accountId: string
  scope?: string
  generation: number
  /** Always false. Durable key grants are reused until the provider revokes them. */
  refreshable: false
}

interface SecretEnvelope {
  key: string
  source: 'apiKey' | 'pkce'
  accountId: string
  scope?: string
}

export function encryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

function encode(envelope: SecretEnvelope): {
  payload: string
  protection: StoredCredential['protection']
} {
  const serialized = JSON.stringify(envelope)
  if (encryptionAvailable()) {
    return {
      payload: safeStorage.encryptString(serialized).toString('base64'),
      protection: 'safeStorage'
    }
  }
  // Same fallback the existing Casdoor integration uses when no keyring exists
  // (e.g. a bare Linux container). It is recorded so the UI can disclose it.
  return { payload: serialized, protection: 'plain' }
}

function decode(record: StoredCredential): SecretEnvelope | null {
  try {
    const serialized =
      record.protection === 'safeStorage'
        ? safeStorage.decryptString(Buffer.from(record.payload, 'base64'))
        : record.payload
    const parsed = JSON.parse(serialized)
    if (!parsed || typeof parsed.key !== 'string') return null
    return parsed as SecretEnvelope
  } catch (error) {
    // A corrupt or unreadable secret must be terminal, not a crash loop: the
    // caller marks the account as needing reauthentication.
    log.warn('OrcaRouter credential could not be read from secret storage', {
      reason: error instanceof Error ? error.name : 'unknown'
    })
    return null
  }
}

/** Persist the credential. Called only after a successful acquisition. */
export function saveCredential(envelope: SecretEnvelope, generation: number): StoredCredential {
  const { payload, protection } = encode(envelope)
  const record: StoredCredential = {
    payload,
    protection,
    source: envelope.source,
    accountId: envelope.accountId,
    scope: envelope.scope,
    generation,
    refreshable: false
  }
  // Metadata only — no key material — so the UI can render status before unlock.
  store.set(`${ORCA_SECRET_STORE_KEY}.meta`, {
    source: record.source,
    accountId: record.accountId,
    scope: record.scope,
    generation: record.generation,
    protection: record.protection
  })
  store.set(ORCA_SECRET_STORE_KEY, record)
  return record
}

/** Read and decrypt the stored credential, or `null` when absent/unreadable. */
export function loadCredential(): SecretEnvelope | null {
  const record = store.get(ORCA_SECRET_STORE_KEY) as StoredCredential | undefined
  if (!record) return null
  return decode(record)
}

/** Metadata for the status UI. Contains no key material. */
export function loadCredentialMeta(): Omit<StoredCredential, 'payload'> | null {
  const record = store.get(ORCA_SECRET_STORE_KEY) as StoredCredential | undefined
  if (record) {
    const { payload: _payload, ...meta } = record
    return meta
  }
  const meta = store.get(`${ORCA_SECRET_STORE_KEY}.meta`) as
    | Omit<StoredCredential, 'payload'>
    | undefined
  return meta ?? null
}

/** Remove the stored credential entirely. */
export function clearCredential(): void {
  store.delete(ORCA_SECRET_STORE_KEY)
  store.delete(`${ORCA_SECRET_STORE_KEY}.meta`)
}

/**
 * Redact the credential for display: enough to recognise which key it is, never
 * enough to use it.
 */
export function maskKey(key: string): string {
  const prefix = key.slice(0, 8)
  return `${prefix}${'•'.repeat(12)}${key.slice(-4)}`
}
