import { is } from '@electron-toolkit/utils'
import { app, shell, BrowserWindow, ipcMain, dialog, protocol as eProtocol, net } from 'electron'
import path, { join } from 'path'
import icon from '../../resources/icon.png?asset'

const winMap = new Map<string, BrowserWindow>()

ipcMain.on('ipc-open-window', (event, arg) => {
  if (winMap.has(arg.id)) {
    winMap.get(arg.id)?.show()
  } else {
    const win = new BrowserWindow({
      width: 800,
      height: 600,
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true
      },
      frame: false,
      show: false
    })
    winMap.set(arg.id, win)
    win.on('closed', () => {
      winMap.delete(arg.id)
    })
    win.on('ready-to-show', () => {
      win.show()
      if (is.dev) {
        win.webContents.openDevTools()
      }
    })
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      const url = new URL(process.env['ELECTRON_RENDERER_URL'])
      // params是一个对象,包含key和value
      Object.entries(arg.params).forEach(([key, value]) => {
        url.searchParams.set(key, JSON.stringify(value))
      })
      win.loadURL(url.toString())
    } else {
      const filePath = join(__dirname, '../renderer/index.html')
      const searchParams = new URLSearchParams()
      Object.entries(arg.params).forEach(([key, value]) => {
        searchParams.set(key, JSON.stringify(value))
      })
      win.loadFile(filePath, {
        search: searchParams.toString()
      })
    }
  }
})

export function closeAllWindows() {
  winMap.forEach((win) => {
    win.close()
  })
}

export function closeWindow(id: string) {
  winMap.get(id)?.close()
}
export function minimizeWindow(id: string) {
  winMap.get(id)?.minimize()
}
export function maximizeWindow(id: string) {
  if (winMap.get(id)?.isMaximized()) {
    winMap.get(id)?.unmaximize()
  } else {
    winMap.get(id)?.maximize()
  }
}
