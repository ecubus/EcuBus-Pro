/**
 * IPC surface for the OrcaRouter provider.
 *
 * The renderer can read status, list models and send a chat turn. It can never
 * read the credential: every relay call is made here, in the main process.
 *
 * @module orcarouter/ipc
 */

import { BrowserWindow, ipcMain, shell } from 'electron'
import log from 'electron-log/main'
import { OrcaService, OrcaPublicStatus } from './service'
import { safeErrorMessage } from './credentials'
import { OrcaCapability, OrcaModality } from './catalog'

/** A user-safe error payload. Never contains a credential or a verifier. */
interface OrcaIpcError {
  message: string
  code: string
}

let service: OrcaService | null = null

/** Lazily construct the singleton so nothing touches `safeStorage` at import time. */
export function getOrcaService(): OrcaService {
  if (!service) {
    service = new OrcaService({
      // The system browser, not a renderer window: the consent page must not be
      // able to reach the renderer's origin, and the user must see the real URL.
      openBrowser: (url: string) => {
        void shell.openExternal(url)
      }
    })
  }
  return service
}

function toIpcError(error: unknown, code: string): OrcaIpcError {
  return { message: safeErrorMessage(error), code }
}

function isCapability(value: unknown): value is OrcaCapability {
  return (
    value === 'chat' ||
    value === 'embedding' ||
    value === 'image' ||
    value === 'video' ||
    value === 'rerank'
  )
}

function isModality(value: unknown): value is OrcaModality {
  return (
    value === 'text' ||
    value === 'image' ||
    value === 'audio' ||
    value === 'video' ||
    value === 'file'
  )
}

/** Notify every window that the credential state changed. */
function broadcastStatus(status: OrcaPublicStatus): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('orcarouter:status-changed', status)
  }
}

export function registerOrcaRouterIpc(): void {
  const orca = getOrcaService()

  orca.store.subscribe((status) => {
    broadcastStatus({ ...status, maskedKey: orca.getStatus().maskedKey })
  })

  ipcMain.handle('orcarouter:get-config', () => orca.getConfig())

  ipcMain.handle('orcarouter:get-status', () => orca.getStatus())

  ipcMain.handle('orcarouter:set-api-key', async (_event, rawKey: unknown) => {
    if (typeof rawKey !== 'string' || rawKey.trim().length === 0) {
      return {
        ok: false as const,
        error: { message: 'Enter an OrcaRouter API key', code: 'invalid_key' }
      }
    }
    try {
      return { ok: true as const, status: await orca.setApiKey(rawKey) }
    } catch (error) {
      return { ok: false as const, error: toIpcError(error, 'invalid_key') }
    }
  })

  ipcMain.handle('orcarouter:connect-start', async () => {
    try {
      const started = await orca.startConnect()
      return { ok: true as const, ...started }
    } catch (error) {
      log.warn('OrcaRouter connect could not start', { reason: safeErrorMessage(error) })
      return { ok: false as const, error: toIpcError(error, 'connect_start_failed') }
    }
  })

  ipcMain.handle('orcarouter:connect-await', async (_event, attemptId: number) => {
    try {
      const status = await orca.awaitConnect(attemptId)
      return { ok: true as const, status }
    } catch (error) {
      return { ok: false as const, error: toIpcError(error, 'connect_failed') }
    }
  })

  ipcMain.handle('orcarouter:connect-cancel', (_event, attemptId?: number) => {
    return { ok: true as const, cancelled: orca.cancelConnect(attemptId) }
  })

  ipcMain.handle('orcarouter:logout', () => {
    try {
      return { ok: true as const, status: orca.logout() }
    } catch (error) {
      return { ok: false as const, error: toIpcError(error, 'logout_failed') }
    }
  })

  ipcMain.handle(
    'orcarouter:list-models',
    async (_event, query: { capability?: unknown; modality?: unknown; force?: unknown }) => {
      const capability = isCapability(query?.capability) ? query.capability : 'chat'
      const modality = isModality(query?.modality) ? query.modality : 'text'
      try {
        const result = await orca.getModels({ capability, modality }, query?.force === true)
        return { ok: true as const, ...result }
      } catch (error) {
        return { ok: false as const, error: toIpcError(error, 'catalog_failed') }
      }
    }
  )

  ipcMain.handle('orcarouter:chat', async (_event, request: unknown) => {
    const body = (request ?? {}) as { model?: unknown; messages?: unknown }
    if (typeof body.model !== 'string' || !Array.isArray(body.messages)) {
      return {
        ok: false as const,
        error: { message: 'A model and a message list are required', code: 'invalid_request' }
      }
    }
    try {
      const result = await orca.chat({
        model: body.model,
        messages: body.messages as { role: 'user' | 'assistant' | 'system'; content: string }[]
      })
      return { ok: true as const, result }
    } catch (error) {
      return { ok: false as const, error: toIpcError(error, 'chat_failed') }
    }
  })
}
