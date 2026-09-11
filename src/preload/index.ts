import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Api } from './api'
import type { GlobOptionsWithFileTypesFalse } from 'glob'
import path from 'path-browserify'
import { ORCA_CHANNELS } from './orcarouter'

const store = {
  get(key: string) {
    return ipcRenderer.sendSync('electron-store-get', key)
  },
  set(property: string, val: any) {
    ipcRenderer.send('electron-store-set', property, val)
  }
}

//replace path.parse
path.parse = (path: string) => {
  return ipcRenderer.sendSync('ipc-path-parse', path)
}
path.relative = (from: string, to: string) => {
  return ipcRenderer.sendSync('ipc-path-relative', from, to)
}
path.join = (...paths: string[]) => {
  return ipcRenderer.sendSync('ipc-path-join', ...paths)
}
path.isAbsolute = (path: string) => {
  return ipcRenderer.sendSync('ipc-path-is-absolute', path)
}

const getPort = (id: string): void => {
  ipcRenderer.once('port', (event, id) => {
    const portCache = event.ports?.[0]
    if (portCache) {
      window.postMessage(id, '*', [portCache])
    }
  })
  ipcRenderer.send('ipc-get-port', id)
}

// Custom APIs for renderer
const api: Api = {
  glob: async (pattern: string | string[], options?: GlobOptionsWithFileTypesFalse) => {
    return ipcRenderer.invoke('ipc-glob', pattern, options)
  },
  readdir: async (path: string) => {
    return ipcRenderer.invoke('ipc-fs-readdir', path)
  },
  state: async (path: string) => {
    return ipcRenderer.invoke('ipc-fs-stat', path)
  },
  getPort
}

// OrcaRouter provider bridge. The credential never crosses this boundary: the
// renderer only sees status metadata and a masked key.
const orca = {
  getConfig: () => ipcRenderer.invoke(ORCA_CHANNELS.getConfig),
  getStatus: () => ipcRenderer.invoke(ORCA_CHANNELS.getStatus),
  setApiKey: (key: string) => ipcRenderer.invoke(ORCA_CHANNELS.setApiKey, key),
  connectStart: () => ipcRenderer.invoke(ORCA_CHANNELS.connectStart),
  connectAwait: (attemptId: number) => ipcRenderer.invoke(ORCA_CHANNELS.connectAwait, attemptId),
  connectCancel: (attemptId?: number) => ipcRenderer.invoke(ORCA_CHANNELS.connectCancel, attemptId),
  // `send`, not `invoke`: `pagehide` can freeze the page before an `invoke`
  // promise settles, and the server-side task still has to be cancelled.
  connectCancelKeepalive: () => ipcRenderer.send(ORCA_CHANNELS.connectCancel, undefined),
  logout: () => ipcRenderer.invoke(ORCA_CHANNELS.logout),
  listModels: (query: { capability?: string; modality?: string; force?: boolean }) =>
    ipcRenderer.invoke(ORCA_CHANNELS.listModels, query),
  chat: (request: { model: string; messages: { role: string; content: string }[] }) =>
    ipcRenderer.invoke(ORCA_CHANNELS.chat, request),
  onStatusChanged: (listener: (event: unknown, status: unknown) => void) =>
    ipcRenderer.on(ORCA_CHANNELS.statusChanged, listener),
  offStatusChanged: (listener: (event: unknown, status: unknown) => void) =>
    ipcRenderer.removeListener(ORCA_CHANNELS.statusChanged, listener)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('api', api)
  contextBridge.exposeInMainWorld('store', store)
  contextBridge.exposeInMainWorld('path', path)
  contextBridge.exposeInMainWorld('orca', orca)
} else {
  throw new Error('contextBridge is not enabled')
}
