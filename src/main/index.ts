import { app, shell, BrowserWindow, ipcMain, dialog, protocol as eProtocol, net } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import Store from 'electron-store'
import './ipc'
import log from 'electron-log/main'
import { createLogs } from './log'
import './update'
import { globalStop } from './ipc/uds'
import Transport from 'winston-transport'
import { initMainI18n } from './i18n'

import { closeAllWindows, closeWindow, logQ, maximizeWindow, minimizeWindow } from './multiWin'

log.initialize()

const protocol = 'ecubuspro'
const ProtocolRegExp = new RegExp(`^${protocol}://`)

// Register custom protocol as privileged before app is ready
eProtocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-resource',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      corsEnabled: true
    }
  }
])

/* single instance */
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}
log.info(app.getGPUFeatureStatus())

function registerLocalResourceProtocol() {
  eProtocol.handle('local-resource', (request) => {
    try {
      // Remove protocol prefix (handle both // and /// after protocol)
      const url = request.url.replace(/^local-resource:\/\/\/?/, '')
      // Decode URL components to handle encoded characters
      const decodedUrl = decodeURIComponent(url)
      // Normalize path (handle both forward and back slashes)
      const normalizedPath = decodedUrl.replace(/\\/g, '/')
      // For Windows absolute paths (e.g., D:/path), ensure proper file:/// format
      const fileUrl = /^[a-zA-Z]:\//.test(normalizedPath)
        ? `file:///${normalizedPath}`
        : `file://${normalizedPath}`

      if (fileUrl.endsWith('.map')) {
        //404
        return new Response(null, { status: 404 })
      }

      return net.fetch(fileUrl)
    } catch (error) {
      log.error('ERROR: registerLocalResourceProtocol:', error)
      return new Response(null, { status: 404 })
    }
  })
}

/* login */

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(protocol, process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient(protocol)
}

// process.env.PYTHON_PATH=pythonPath
const isDev = process.env.NODE_ENV === 'development'

const store = new Store()

ipcMain.on('electron-store-get', async (event, val) => {
  event.returnValue = store.get(val)
})
ipcMain.on('electron-store-set', async (event, key, val) => {
  store.set(key, val)
})

class ElectronLog extends Transport {
  constructor(
    private q: typeof logQ,
    opts?: Transport.TransportStreamOptions
  ) {
    super(opts)
  }

  log(info: any, callback: () => void) {
    if (info.message?.method) {
      this.q.list.push(info)
    } else {
      this.q.win.forEach((win) => {
        win.webContents.send('ipc-log-main', info)
      })
    }
    callback()
  }
}

function createWindow(): void {
  // Get stored window bounds and state
  const windowBounds = store.get('windowBounds') as Electron.Rectangle
  const isMaximized = store.get('windowMaximized', false)

  function getBounds() {
    const bounds = global.mainWindow.getBounds()
    // bounds.x += 5
    // bounds.y += 5
    return bounds
  }
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    minWidth: 1000,
    minHeight: 600,
    width: 1000,
    height: 600,

    frame: false,
    show: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      backgroundThrottling: false,
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })
  if (windowBounds) {
    mainWindow.setBounds(windowBounds)
  }
  global.mainWindow = mainWindow
  logQ.addWin(mainWindow, true)
  createLogs(
    [
      () =>
        new ElectronLog(logQ, {
          level: 'debug'
        })
    ],
    []
  )
  ipcMain.on('minimize', (event, id) => {
    if (id) {
      minimizeWindow(id)
    } else {
      mainWindow?.minimize()
    }
  })

  ipcMain.on('maximize', (event, id) => {
    if (id) {
      maximizeWindow(id)
    } else {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize()
        store.set('windowMaximized', false)
      } else {
        mainWindow.maximize()
        store.set('windowMaximized', true)
      }
      // Save current bounds before maximizing
      store.set('windowBounds', getBounds())
    }
  })

  ipcMain.on('close', (event, id) => {
    logQ.stopTimer()
    if (id) {
      closeWindow(id)
    } else {
      globalStop()
      // Only save bounds if window is not maximized
      store.set('windowBounds', getBounds())
      store.set('windowMaximized', mainWindow.isMaximized())
      closeAllWindows()
      mainWindow.close()
    }
  })
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    // Restore maximized state
    if (isMaximized) {
      mainWindow.maximize()
    }
    if (isDev) {
      mainWindow.webContents.openDevTools()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerLocalResourceProtocol()

  // 初始化主进程 i18n
  try {
    const savedLang = store.get('language', 'en') as string
    await initMainI18n(savedLang)
    log.info(`Main process i18n initialized with language: ${savedLang}`)
  } catch (error) {
    log.error('Failed to initialize main process i18n:', error)
  }

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
