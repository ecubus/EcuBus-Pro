/**
 * Renderer-facing bridge for the OrcaRouter provider.
 *
 * Every call is an IPC round trip. The credential lives in the main process and
 * is never exposed here — the renderer only ever sees status metadata and the
 * masked key.
 *
 * @module preload/orcarouter
 */

export type OrcaCredentialSource = 'apiKey' | 'pkce'

export interface OrcaStatus {
  status: 'none' | 'configured' | 'needsReauth'
  source?: OrcaCredentialSource
  accountId?: string
  scope?: string
  generation: number
  maskedKey?: string
}

export interface OrcaConfig {
  authBase: string
  apiBase: string
  appName: string
  consoleUrl: string
  secretEncrypted: boolean
}

export interface OrcaModel {
  id: string
  name?: string
  contextLength?: number
  maxCompletionTokens?: number
  inputModalities: string[]
  outputModalities: string[]
  endpointTypes: string[]
  ownedBy?: string
  reasoning?: boolean
  reasoningEfforts?: string[]
}

export interface OrcaIpcError {
  message: string
  code: string
}

export interface OrcaOk<T> {
  ok: true
}

export interface OrcaFail {
  ok: false
  error: OrcaIpcError
}

export type OrcaResult<T> = ({ ok: true } & T) | OrcaFail

export interface OrcaBridge {
  getConfig(): Promise<OrcaConfig>
  getStatus(): Promise<OrcaStatus>
  setApiKey(key: string): Promise<OrcaResult<{ status: OrcaStatus }>>
  connectStart(): Promise<OrcaResult<{ attemptId: number; authorizeUrl: string; port: number }>>
  connectAwait(attemptId: number): Promise<OrcaResult<{ status: OrcaStatus }>>
  connectCancel(attemptId?: number): Promise<{ ok: true; cancelled: boolean }>
  /** Fire-and-forget cancel used from `pagehide`, where the page may be frozen. */
  connectCancelKeepalive(): void
  logout(): Promise<OrcaResult<{ status: OrcaStatus }>>
  listModels(query: { capability?: string; modality?: string; force?: boolean }): Promise<
    OrcaResult<{
      models: OrcaModel[]
      source: 'live' | 'cache' | 'seed'
      degraded: boolean
      reason?: string
    }>
  >
  chat(request: {
    model: string
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  }): Promise<OrcaResult<{ result: { model: string; content: string } }>>
  onStatusChanged(listener: (event: unknown, status: OrcaStatus) => void): void
  offStatusChanged(listener: (event: unknown, status: OrcaStatus) => void): void
}

export const ORCA_CHANNELS = {
  getConfig: 'orcarouter:get-config',
  getStatus: 'orcarouter:get-status',
  setApiKey: 'orcarouter:set-api-key',
  connectStart: 'orcarouter:connect-start',
  connectAwait: 'orcarouter:connect-await',
  connectCancel: 'orcarouter:connect-cancel',
  logout: 'orcarouter:logout',
  listModels: 'orcarouter:list-models',
  chat: 'orcarouter:chat',
  statusChanged: 'orcarouter:status-changed'
} as const
