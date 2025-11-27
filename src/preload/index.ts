import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Api } from './api'
import type { GlobOptionsWithFileTypesFalse } from 'glob'
import path from 'path-browserify'

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

// Custom APIs for renderer
const api: Api = {
  glob: async (pattern: string | string[], options?: GlobOptionsWithFileTypesFalse) => {
    return ipcRenderer.invoke('ipc-glob', pattern, options)
  },
  readFile: async (path: string) => {
    return ipcRenderer.invoke('ipc-fs-readFile', path)
  },
  writeFile: async (path: string, data: string) => {
    return ipcRenderer.invoke('ipc-fs-writeFile', path, data)
  },
  readdir: async (path: string) => {
    return ipcRenderer.invoke('ipc-fs-readdir', path)
  },
  state: async (path: string) => {
    return ipcRenderer.invoke('ipc-fs-stat', path)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('api', api)
  contextBridge.exposeInMainWorld('store', store)
  contextBridge.exposeInMainWorld('path', path)
} else {
  throw new Error('contextBridge is not enabled')
}
