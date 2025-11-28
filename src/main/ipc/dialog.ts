import { ipcMain, dialog } from 'electron'

ipcMain.handle('ipc-show-open-dialog', async (event, options: Electron.OpenDialogOptions) => {
  return await dialog.showOpenDialog(options)
})

ipcMain.handle('ipc-show-save-dialog', async (event, options: Electron.SaveDialogOptions) => {
  return await dialog.showSaveDialog(options)
})

ipcMain.handle('ipc-show-message-box', async (event, options: Electron.MessageBoxOptions) => {
  return await dialog.showMessageBox(options)
})

ipcMain.handle('icp-show-error-box', async (event, title: string, content: string) => {
  return await dialog.showErrorBox(title, content)
})
