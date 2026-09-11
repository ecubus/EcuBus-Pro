/**
 * OrcaRouter provider service — the single seam every AI entry point goes
 * through.
 *
 * It owns the credential store, the two credential adapters (pasted API key and
 * OAuth 2.0 + PKCE account login), live model discovery and the inference
 * client. Rendering is the renderer's job; the credential never leaves the main
 * process.
 *
 * @module orcarouter/service
 */

import log from 'electron-log/main'
import {
  AcquiredCredential,
  ApiKeyAdapter,
  CredentialRejectedError,
  InvalidKeyFormatError,
  OrcaCredential,
  OrcaCredentialStore,
  OrcaStatus,
  ORCA_KEY_PREFIX,
  PkceAdapter,
  safeErrorMessage
} from './credentials'
import { OrcaClient, OrcaRequestError, ChatRequest, ChatResult } from './client'
import { ModelDiscovery } from './discovery'
import { CatalogResult, ModelQuery, OrcaCapability, OrcaModality } from './catalog'
import { OrcaOrigins, resolveOrigins, CONSOLE_AUTHORIZED_APPS_URL } from './origins'
import { APP_NAME, ConnectHandle, ConnectResult, PkceConnectService } from './pkceFlow'
import {
  clearCredential,
  encryptionAvailable,
  loadCredential,
  loadCredentialMeta,
  saveCredential
} from './secretStorage'

export interface OrcaProviderConfig {
  authBase: string
  apiBase: string
  appName: string
  /** Where the user manages/revokes issued keys. */
  consoleUrl: string
  /** True when the OS keyring is unavailable and the secret is not encrypted at rest. */
  secretEncrypted: boolean
}

/** Where a credential is persisted. Backed by safeStorage in the main process. */
export interface OrcaStoragePort {
  save(
    envelope: { key: string; source: 'apiKey' | 'pkce'; accountId: string; scope?: string },
    generation: number
  ): void
  load(): { key: string; source: 'apiKey' | 'pkce'; accountId: string; scope?: string } | null
  clear(): void
  encryptionAvailable(): boolean
}

const defaultStorage: OrcaStoragePort = {
  save: (envelope, generation) => {
    saveCredential(envelope, generation)
  },
  load: () => {
    const stored = loadCredential()
    if (!stored) return null
    const meta = loadCredentialMeta()
    return {
      key: stored.key,
      // The envelope is the authority for the key; metadata carries the
      // lifecycle fields, so a partially-written record still restores safely.
      source: stored.source ?? meta?.source ?? 'apiKey',
      accountId: stored.accountId ?? meta?.accountId ?? '',
      scope: stored.scope ?? meta?.scope
    }
  },
  clear: clearCredential,
  encryptionAvailable
}

/** Public status payload. Contains no key material. */
export interface OrcaPublicStatus extends OrcaStatus {
  /** Masked key for recognition only. Absent when no credential is held. */
  maskedKey?: string
}

export interface OrcaServiceDeps {
  origins?: OrcaOrigins
  client?: OrcaClient
  connectService?: PkceConnectService
  /** Opens the system browser. Injected so tests never spawn a browser. */
  openBrowser: (url: string) => void
  /** Optional extra source for a pasted key (e.g. the Settings form). */
  readConfiguredKey?: () => Promise<string | undefined | null>
  /** Credential persistence. Defaults to the safeStorage-backed vault. */
  storage?: OrcaStoragePort
}

export class OrcaService {
  readonly origins: OrcaOrigins
  readonly store = new OrcaCredentialStore()
  readonly connect: PkceConnectService
  readonly discovery: ModelDiscovery
  private readonly client: OrcaClient
  private readonly openBrowser: (url: string) => void
  private readonly configuredKey: () => Promise<string | undefined | null>
  private readonly storage: OrcaStoragePort

  /** The in-flight connect attempt, so a late result cannot be adopted twice. */
  private pendingConnect: { attemptId: number; handle: ConnectHandle } | null = null

  constructor(deps: OrcaServiceDeps) {
    this.origins = deps.origins ?? resolveOrigins()
    this.client = deps.client ?? new OrcaClient(this.origins)
    this.connect = deps.connectService ?? new PkceConnectService()
    this.openBrowser = deps.openBrowser
    this.configuredKey = deps.readConfiguredKey ?? (async () => this.storage.load()?.key)
    this.storage = deps.storage ?? defaultStorage

    this.discovery = new ModelDiscovery((capability) => {
      const ticket = this.store.credentialForRequest()
      return this.client.listModels(ticket.credential, capability)
    })

    this.restore()
  }

  /**
   * Adapter 1 — an API key the user already holds. Works with no browser and no
   * account login, so this path stays usable on locked-down machines.
   */
  apiKeyAdapter(rawKey?: string): ApiKeyAdapter {
    return new ApiKeyAdapter(async () => rawKey ?? this.configuredKey())
  }

  /**
   * Adapter 2 — "Connect with OrcaRouter". Wraps an in-flight loopback attempt
   * in the same adapter interface, so both credentials are produced identically.
   */
  pkceAdapterFor(handle: ConnectHandle): PkceAdapter {
    return new PkceAdapter(() => handle.result as Promise<ConnectResult>)
  }

  /** Reload a previously stored credential so restarts reuse it. */
  restore(): boolean {
    const envelope = this.storage.load()
    if (!envelope || !envelope.key) return false
    this.store.commit({
      key: envelope.key,
      source: envelope.source,
      scope: envelope.scope,
      accountId: envelope.accountId
    })
    log.info('OrcaRouter credential restored from secret storage', {
      source: envelope.source
    })
    return true
  }

  getConfig(): OrcaProviderConfig {
    return {
      authBase: this.origins.authBase,
      apiBase: this.origins.apiBase,
      appName: APP_NAME,
      consoleUrl: CONSOLE_AUTHORIZED_APPS_URL,
      secretEncrypted: this.storage.encryptionAvailable()
    }
  }

  getStatus(): OrcaPublicStatus {
    const credential = this.store.getCredential()
    return {
      ...this.store.getStatus(),
      maskedKey: credential ? maskCredential(credential) : undefined
    }
  }

  /** Adapter 1 entry point: save and adopt a pasted key. */
  async setApiKey(key: string): Promise<OrcaPublicStatus> {
    const acquired = await this.apiKeyAdapter(key).acquire()
    return this.adopt(acquired)
  }

  /**
   * Adapter 2 entry point, phase 1. Binds the loopback listener and returns the
   * authorize URL to display. Nothing is adopted until phase 2 succeeds.
   */
  async startConnect(): Promise<{ attemptId: number; authorizeUrl: string; port: number }> {
    const handle = await this.connect.start(this.origins, this.openBrowser)
    this.pendingConnect = { attemptId: handle.attemptId, handle }
    return {
      attemptId: handle.attemptId,
      authorizeUrl: handle.authorizeUrl,
      port: handle.port
    }
  }

  /**
   * Adapter 2 entry point, phase 2. Waits for the code to be exchanged and
   * adopts the resulting key. Resolves through the same adapter interface the
   * API-key path uses.
   */
  async awaitConnect(attemptId: number): Promise<OrcaPublicStatus> {
    const pending = this.pendingConnect
    if (!pending || pending.attemptId !== attemptId) {
      throw new Error('OrcaRouter sign-in is no longer active')
    }
    const acquired = await this.pkceAdapterFor(pending.handle).acquire()
    // A newer attempt may have started while this one was finishing; if so its
    // result already won and this one must not overwrite it.
    if (this.pendingConnect?.attemptId !== attemptId) {
      throw new Error('OrcaRouter sign-in was superseded by a newer attempt')
    }
    this.pendingConnect = null
    return this.adopt(acquired)
  }

  /** Release the in-flight attempt. Safe when nothing is in flight. */
  cancelConnect(attemptId?: number): boolean {
    const cancelled = this.connect.cancel(attemptId)
    if (
      this.pendingConnect &&
      (attemptId === undefined || this.pendingConnect.attemptId === attemptId)
    ) {
      this.pendingConnect = null
    }
    return cancelled
  }

  /** Model list for one entry point, filtered by capability and modality. */
  async getModels(query: ModelQuery, force = false): Promise<CatalogResult> {
    if (!this.store.getCredential()) {
      throw new Error('OrcaRouter is not authenticated')
    }
    return this.discovery.resolve(query, force)
  }

  /** One chat completion against the relay. */
  async chat(request: ChatRequest): Promise<ChatResult> {
    const ticket = this.store.credentialForRequest()
    try {
      return await this.client.chat(ticket.credential, request)
    } catch (error) {
      this.handleRejection(error, ticket.accountId, ticket.generation)
      throw normaliseError(error)
    }
  }

  /** Clear the credential from memory and from secret storage. */
  logout(): OrcaPublicStatus {
    this.cancelConnect()
    this.store.clear()
    this.storage.clear()
    this.discovery.clear()
    return this.getStatus()
  }

  /**
   * A `401` is terminal: mark the exact credential that made the request and
   * never attempt a refresh. A late failure from an older generation is a no-op.
   */
  private handleRejection(error: unknown, accountId: string, generation: number): void {
    if (error instanceof CredentialRejectedError) {
      const applied = this.store.markNeedsReauth(accountId, generation)
      log.warn('OrcaRouter rejected a credential', { applied, generation })
    }
  }

  /** Adopt an acquired credential into the store and persist it. */
  adopt(acquired: AcquiredCredential): OrcaPublicStatus {
    const credential = this.store.commit(acquired)
    this.storage.save(
      {
        key: credential.key,
        source: credential.source,
        accountId: credential.accountId,
        scope: credential.scope
      },
      credential.generation
    )
    log.info('OrcaRouter credential stored', { source: credential.source })
    return this.getStatus()
  }
}

/**
 * Redact the credential for display.
 *
 * Only the fixed, non-secret `sk-orca-` prefix is kept; the rest is bullets, so
 * no character of the live key — not even a trailing fragment — can reach a
 * screenshot, a log line or a support paste.
 */
function maskCredential(credential: OrcaCredential): string {
  const key = credential.key
  const prefix = key.startsWith(ORCA_KEY_PREFIX) ? ORCA_KEY_PREFIX : ''
  return `${prefix}${'•'.repeat(16)}`
}

/** Map internal errors to messages that are safe to show and safe to log. */
export function normaliseError(error: unknown): Error {
  if (
    error instanceof InvalidKeyFormatError ||
    error instanceof CredentialRejectedError ||
    error instanceof OrcaRequestError
  ) {
    return error
  }
  return new Error(safeErrorMessage(error))
}

export type { OrcaCapability, OrcaModality }
