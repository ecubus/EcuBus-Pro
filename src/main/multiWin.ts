import { is } from '@electron-toolkit/utils'
import { app, shell, BrowserWindow, ipcMain, dialog, protocol as eProtocol, net } from 'electron'
import path, { join } from 'path'
import icon from '../../resources/icon.png?asset'

class LogQueue {
  list: any[] = []
  timer: any
  mainWin: BrowserWindow | undefined
  constructor(
    public win: BrowserWindow[],
    private period = 100
  ) {
    this.timer = setInterval(() => {
      if (this.list.length) {
        this.mainWin!.webContents.send('ipc-log', this.list)
        this.list = []
      }
    }, this.period)
  }
  addWin(win: BrowserWindow, isMain: boolean) {
    this.win.push(win)
    if (isMain) {
      this.mainWin = win
    }
  }
  removeWin(win: BrowserWindow) {
    this.win = this.win.filter((w) => w !== win)
  }
}
export const logQ = new LogQueue([])

const winMap = new Map<string, BrowserWindow>()

ipcMain.on('ipc-open-window', (event, arg) => {
  if (winMap.has(arg.id)) {
    winMap.get(arg.id)?.show()
  } else {
    const win = new BrowserWindow({
      width: arg.w || 800,
      height: arg.h || 600,
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
    logQ.addWin(win, false)
    win.on('closed', () => {
      winMap.delete(arg.id)
      logQ.mainWin?.webContents.send('ipc-close-window', arg.id)
      logQ.removeWin(win)
    })
    win.on('ready-to-show', () => {
      win.show()
      if (is.dev) {
        win.webContents.openDevTools()
      }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      const url = new URL(process.env['ELECTRON_RENDERER_URL'])
      Object.entries(arg).forEach(([key, value]) => {
        url.searchParams.set(key, String(value))
      })
      win.loadURL(url.toString())
    } else {
      const filePath = join(__dirname, '../renderer/index.html')
      const searchParams = new URLSearchParams()
      Object.entries(arg).forEach(([key, value]) => {
        searchParams.set(key, String(value))
      })
      win.loadFile(filePath, {
        search: searchParams.toString()
      })
    }
  }
})

ipcMain.on('ipc-close-others-windows', (event, arg) => {
  winMap.forEach((item) => {
    item.close()
  })
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
