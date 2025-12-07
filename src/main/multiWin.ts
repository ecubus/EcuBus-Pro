import { is } from '@electron-toolkit/utils'
import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol as eProtocol,
  net,
  MessageChannelMain,
  MessagePortMain
} from 'electron'
import path, { join } from 'path'
import icon from '../../resources/icon.png?asset'
let port: MessagePortMain | null = null
ipcMain.on('ipc-get-port', (event, id: string) => {
  if (port) {
    port.close()
  }
  const { port1, port2 } = new MessageChannelMain()
  port = port1
  event.sender.postMessage('port', id, [port2])
  // port2.start()
})
class LogQueue {
  private static instance: LogQueue | null = null
  list: any[] = []
  timer: any
  mainWin: BrowserWindow | undefined

  private constructor(
    public win: BrowserWindow[] = [],
    private period = 100
  ) {
    this.startTimer()
  }

  static getInstance(): LogQueue {
    if (LogQueue.instance === null) {
      LogQueue.instance = new LogQueue()
    }
    return LogQueue.instance
  }

  addWin(win: BrowserWindow, isMain: boolean) {
    this.win.push(win)
    if (isMain) {
      this.mainWin = win
    }
  }
  protected startTimer() {
    this.timer = setInterval(() => {
      if (this.list.length) {
        port?.postMessage(this.list)
        this.list = []
      }
    }, this.period)
  }
  stopTimer() {
    clearInterval(this.timer)
    this.list = []
  }
  removeWin(win: BrowserWindow) {
    this.win = this.win.filter((w) => w !== win)
  }
}

// Export the singleton instance
export const logQ = LogQueue.getInstance()

// Export a function to get the instance (alternative access method)
export const getLogQueue = () => LogQueue.getInstance()

// Export the class for type annotations if needed
export type { LogQueue }

const winMap = new Map<string, BrowserWindow>()
const winPosMap = new Map<string, { x: number; y: number; width: number; height: number }>()

ipcMain.on('ipc-open-window', (event, arg) => {
  if (winMap.has(arg.id)) {
    winMap.get(arg.id)?.show()
  } else {
    const pos = winPosMap.get(arg.id)
    const win = new BrowserWindow({
      width: pos?.width || arg.w || 800,
      height: pos?.height || arg.h || 600,
      x: pos?.x || undefined,
      y: pos?.y || undefined,
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        backgroundThrottling: false
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
  closeAllWindows()
})
export function closeAllWindows() {
  winMap.forEach((win, key) => {
    //store pos

    const pos = win.getBounds()
    winPosMap.set(key, {
      x: pos?.x,
      y: pos?.y,
      width: pos?.width,
      height: pos?.height
    })
    win.close()
  })
}

export function closeWindow(id: string) {
  const win = winMap.get(id)
  if (win) {
    //store pos
    const pos = win.getBounds()
    winPosMap.set(id, {
      x: pos?.x,
      y: pos?.y,
      width: pos?.width,
      height: pos?.height
    })
    win.close()
  }
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
