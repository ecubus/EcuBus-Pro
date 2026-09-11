import { describe, expect, it } from 'vitest'
import {
  ApiKeyAdapter,
  CredentialRejectedError,
  InvalidKeyFormatError,
  OrcaCredentialStore,
  ORCA_KEY_PREFIX,
  PkceAdapter,
  fingerprintKey,
  redactSecrets,
  safeErrorMessage
} from '../../src/main/orcarouter/credentials'

/** Obviously fake keys. No real credential is ever used in a test. */
const FAKE_KEY = 'sk-orca-test0000000000000000000000000000'
const FAKE_KEY_2 = 'sk-orca-second000000000000000000000000000'

describe('orcarouter api key adapter', () => {
  it('produces a credential from a pasted key', async () => {
    const adapter = new ApiKeyAdapter(async () => FAKE_KEY)
    const acquired = await adapter.acquire()
    expect(acquired.source).toBe('apiKey')
    expect(acquired.key).toBe(FAKE_KEY)
    expect(adapter.labelKey).toBe('ai.orcaAuthMethodApiKey')
  })

  it('trims surrounding whitespace from a pasted key', async () => {
    const adapter = new ApiKeyAdapter(async () => `  ${FAKE_KEY}\n`)
    expect((await adapter.acquire()).key).toBe(FAKE_KEY)
  })

  it('rejects a key that does not look like an OrcaRouter key', async () => {
    for (const raw of ['sk-openai-abc', 'nope', `${ORCA_KEY_PREFIX}`, '']) {
      const adapter = new ApiKeyAdapter(async () => raw)
      await expect(adapter.acquire()).rejects.toBeInstanceOf(InvalidKeyFormatError)
    }
  })

  it('rejects when no key is configured', async () => {
    const adapter = new ApiKeyAdapter(async () => null)
    await expect(adapter.acquire()).rejects.toBeInstanceOf(InvalidKeyFormatError)
  })

  it('derives a stable, non-reversible account id', async () => {
    const a = await new ApiKeyAdapter(async () => FAKE_KEY).acquire()
    const b = await new ApiKeyAdapter(async () => FAKE_KEY).acquire()
    const c = await new ApiKeyAdapter(async () => FAKE_KEY_2).acquire()
    expect(a.accountId).toBe(b.accountId)
    expect(a.accountId).not.toBe(c.accountId)
    expect(a.accountId).not.toContain(FAKE_KEY)
    expect(fingerprintKey(FAKE_KEY)).toMatch(/^fp_[0-9a-f]{16}$/)
  })

  it('never puts the key in an error message', async () => {
    const adapter = new ApiKeyAdapter(async () => 'definitely-not-a-key')
    try {
      await adapter.acquire()
      throw new Error('should have thrown')
    } catch (error) {
      expect(String((error as Error).message)).not.toContain('definitely-not-a-key')
    }
  })

  it('accepts an updated key and a cleared key independently', async () => {
    let current: string | null = null
    const adapter = new ApiKeyAdapter(async () => current)
    await expect(adapter.acquire()).rejects.toBeInstanceOf(InvalidKeyFormatError)
    current = FAKE_KEY
    expect((await adapter.acquire()).key).toBe(FAKE_KEY)
    current = null
    await expect(adapter.acquire()).rejects.toBeInstanceOf(InvalidKeyFormatError)
  })
})

describe('orcarouter pkce adapter', () => {
  it('produces the same credential shape as the API-key adapter', async () => {
    const apiCredential = await new ApiKeyAdapter(async () => FAKE_KEY).acquire()
    const pkceCredential = await new PkceAdapter(async () => ({
      key: FAKE_KEY,
      userId: '12345',
      scope: 'api'
    })).acquire()

    // Downstream code only ever sees these four fields, regardless of source.
    expect(Object.keys(pkceCredential).sort()).toEqual(Object.keys(apiCredential).sort())
    expect(pkceCredential.key).toBe(apiCredential.key)
    expect(pkceCredential.source).toBe('pkce')
    expect(pkceCredential.scope).toBe('api')
    expect(pkceCredential.accountId).toBe('uid_12345')
  })

  it('falls back to a fingerprint when the exchange issued no user id', async () => {
    const acquired = await new PkceAdapter(async () => ({ key: FAKE_KEY })).acquire()
    expect(acquired.accountId).toBe(fingerprintKey(FAKE_KEY))
  })

  it('rejects a malformed key returned by the exchange', async () => {
    const adapter = new PkceAdapter(async () => ({ key: 'sk-something-else' }))
    await expect(adapter.acquire()).rejects.toBeInstanceOf(InvalidKeyFormatError)
  })

  it('propagates a denial without inventing a credential', async () => {
    const adapter = new PkceAdapter(async () => {
      throw new Error('OrcaRouter sign-in was declined on the consent screen')
    })
    await expect(adapter.acquire()).rejects.toThrow(/declined/)
  })
})

describe('orcarouter credential store', () => {
  it('adopts a credential from either adapter and reports the source', () => {
    const store = new OrcaCredentialStore()
    expect(store.getStatus().status).toBe('none')

    store.commit({ key: FAKE_KEY, source: 'apiKey', accountId: 'fp_a' })
    expect(store.getStatus()).toMatchObject({ status: 'configured', source: 'apiKey' })
    expect(store.getCredential()?.generation).toBe(1)

    store.commit({ key: FAKE_KEY_2, source: 'pkce', accountId: 'uid_2' })
    expect(store.getStatus()).toMatchObject({ status: 'configured', source: 'pkce' })
    expect(store.getCredential()?.generation).toBe(2)
  })

  it('bumps the generation on every replacement', () => {
    const store = new OrcaCredentialStore()
    store.commit({ key: FAKE_KEY, source: 'apiKey', accountId: 'a' })
    store.commit({ key: FAKE_KEY, source: 'apiKey', accountId: 'a' })
    store.commit({ key: FAKE_KEY_2, source: 'apiKey', accountId: 'b' })
    expect(store.getGeneration()).toBe(3)
  })

  it('marks the exact rejected account and generation as needing reauth', () => {
    const store = new OrcaCredentialStore()
    store.commit({ key: FAKE_KEY, source: 'apiKey', accountId: 'fp_a' })
    const generation = store.getGeneration()

    expect(store.markNeedsReauth('fp_a', generation)).toBe(true)
    expect(store.getStatus().status).toBe('needsReauth')
  })

  it('ignores a rejection for a different account', () => {
    const store = new OrcaCredentialStore()
    store.commit({ key: FAKE_KEY, source: 'apiKey', accountId: 'fp_a' })
    expect(store.markNeedsReauth('fp_other', store.getGeneration())).toBe(false)
    expect(store.getStatus().status).toBe('configured')
  })

  it('never lets a late failure from an old generation poison a new credential', () => {
    const store = new OrcaCredentialStore()
    store.commit({ key: FAKE_KEY, source: 'apiKey', accountId: 'fp_a' })
    const stale = store.credentialForRequest()

    // The user signs in again while the old request is still in flight.
    store.commit({ key: FAKE_KEY_2, source: 'pkce', accountId: 'uid_new' })

    // The old response finally fails. It must be a no-op.
    expect(store.markNeedsReauth(stale.accountId, stale.generation)).toBe(false)
    expect(store.getStatus().status).toBe('configured')
    expect(store.getStatus().accountId).toBe('uid_new')
  })

  it('clears a rejection when a replacement credential is adopted', () => {
    const store = new OrcaCredentialStore()
    store.commit({ key: FAKE_KEY, source: 'apiKey', accountId: 'fp_a' })
    store.markNeedsReauth('fp_a', store.getGeneration())
    expect(store.getStatus().status).toBe('needsReauth')

    store.commit({ key: FAKE_KEY_2, source: 'pkce', accountId: 'uid_new' })
    expect(store.getStatus().status).toBe('configured')
  })

  it('resolves the credential for a request with its generation', () => {
    const store = new OrcaCredentialStore()
    store.commit({ key: FAKE_KEY, source: 'apiKey', accountId: 'fp_a' })
    const ticket = store.credentialForRequest()
    expect(ticket.credential.key).toBe(FAKE_KEY)
    expect(ticket.generation).toBe(store.getGeneration())
  })

  it('refuses to resolve a request when unauthenticated', () => {
    expect(() => new OrcaCredentialStore().credentialForRequest()).toThrow(/not authenticated/i)
  })

  it('clears the credential and reports the empty state', () => {
    const store = new OrcaCredentialStore()
    store.commit({ key: FAKE_KEY, source: 'apiKey', accountId: 'fp_a' })
    store.clear()
    expect(store.getStatus().status).toBe('none')
    expect(store.getCredential()).toBeNull()
  })

  it('notifies subscribers, including about rejections', () => {
    const store = new OrcaCredentialStore()
    const seen: string[] = []
    const unsubscribe = store.subscribe((status) => seen.push(status.status))

    store.commit({ key: FAKE_KEY, source: 'apiKey', accountId: 'fp_a' })
    store.markNeedsReauth('fp_a', store.getGeneration())
    store.clear()
    unsubscribe()
    store.commit({ key: FAKE_KEY, source: 'apiKey', accountId: 'fp_a' })

    expect(seen).toEqual(['configured', 'needsReauth', 'none'])
  })
})

describe('orcarouter secret redaction', () => {
  it('replaces a key with a placeholder', () => {
    const redacted = redactSecrets(`failed with Authorization: Bearer ${FAKE_KEY}`)
    expect(redacted).not.toContain(FAKE_KEY)
    expect(redacted).toContain(`${ORCA_KEY_PREFIX}***`)
  })

  it('redacts a key embedded in a url or json body', () => {
    expect(redactSecrets(`{"api_key":"${FAKE_KEY}"}`)).not.toContain(FAKE_KEY)
    expect(redactSecrets(`https://x/y?key=${FAKE_KEY}`)).not.toContain(FAKE_KEY)
  })

  it('redacts verifier and code fields', () => {
    const redacted = redactSecrets('{"code_verifier":"abc123def456ghi","code":"zzz999yyy888"}')
    expect(redacted).not.toContain('abc123def456ghi')
    expect(redacted).not.toContain('zzz999yyy888')
  })

  it('leaves a harmless message alone', () => {
    expect(redactSecrets('OrcaRouter request failed with HTTP 500')).toBe(
      'OrcaRouter request failed with HTTP 500'
    )
  })

  it('produces a secret-free message for any error shape', () => {
    expect(safeErrorMessage(new Error(`bad key ${FAKE_KEY}`))).not.toContain(FAKE_KEY)
    expect(safeErrorMessage(`raw ${FAKE_KEY}`)).not.toContain(FAKE_KEY)
    expect(safeErrorMessage({ key: FAKE_KEY })).not.toContain(FAKE_KEY)
  })

  it('carries the rejected account and generation on the terminal error', () => {
    const error = new CredentialRejectedError('fp_a', 7)
    expect(error.accountId).toBe('fp_a')
    expect(error.generation).toBe(7)
    expect(error.message).not.toContain(FAKE_KEY)
  })
})
