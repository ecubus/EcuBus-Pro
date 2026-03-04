import { ipcMain, app } from 'electron'
import { exportOtherFile, parseFile } from '../canmartix'
import path from 'path'

ipcMain.handle('ipc-canmartix-parse', async (event, arg) => {
  const result = await parseFile(arg, path.join(app.getPath('temp'), 'canmartix.json'))
  return result
})

ipcMain.handle('ipc-canmartix-exportOtherFile', async (event, arg) => {
  const tmpDir = app.getPath('temp')
  const fileType = arg.fileType
  const candb = arg.candb
  const outputFilePath = arg.outputFilePath
  await exportOtherFile(tmpDir, fileType, candb, outputFilePath)
})
