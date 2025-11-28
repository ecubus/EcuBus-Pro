import { autoUpdater, CancellationToken } from 'electron-updater'
import log from 'electron-log'
import { URL } from 'url'
import { BrowserWindow, ipcMain } from 'electron'
import axios from 'axios'

//https://ecubus.oss-cn-chengdu.aliyuncs.com/README.md
const feedUrl = new URL(`/app`, 'https://ecubus.oss-cn-chengdu.aliyuncs.com').href
autoUpdater.autoDownload = false
autoUpdater.logger = log
log.transports.file.level = 'info'
let cancellationToken: CancellationToken | undefined
autoUpdater.setFeedURL(feedUrl)

autoUpdater.on('update-available', (info) => {
  BrowserWindow.getAllWindows()[0].webContents.send('ipc-update-available', info)
})
autoUpdater.on('update-not-available', (info) => {
  BrowserWindow.getAllWindows()[0].webContents.send('ipc-update-not-available', info)
})
autoUpdater.on('error', (err) => {
  BrowserWindow.getAllWindows()[0].webContents.send('ipc-update-error', err)
})
autoUpdater.on('download-progress', (progressObj) => {
  BrowserWindow.getAllWindows()[0].webContents.send('ipc-update-download-progress', progressObj)
})
autoUpdater.on('update-downloaded', (info) => {
  BrowserWindow.getAllWindows()[0].webContents.send('ipc-update-downloaded', info)
})

ipcMain.on('ipc-check-update', () => {
  void autoUpdater.checkForUpdates()
})

ipcMain.on('ipc-start-update', () => {
  cancellationToken = new CancellationToken()
  void autoUpdater.downloadUpdate(cancellationToken)
})

ipcMain.on('ipc-stop-update', () => {
  cancellationToken?.cancel()
})
ipcMain.handle('ipc-update-releases-note', async (event, ...args) => {
  const ver = args[0]
  const response = await axios.get(
    new URL(
      `/app/releases_note${ver ? '_' + ver : ''}.md`,
      'https://ecubus.oss-cn-chengdu.aliyuncs.com'
    ).href,
    {
      method: 'Get'
    }
  )
  return response.data
})
ipcMain.on('ipc-install-update', () => {
  autoUpdater.quitAndInstall(false, false)
})
