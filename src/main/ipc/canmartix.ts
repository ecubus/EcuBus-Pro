import { ipcMain, app } from 'electron'
import { exportOtherFile, parseFile } from '../canmartix'
import path from 'path'
import fs from 'fs'

ipcMain.handle('ipc-canmartix-parse', async (event, arg) => {
  //try remove file if exists
  const tmpDir = app.getPath('temp')
  const filePath = path.join(tmpDir, 'canmartix.json')
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
  const result = await parseFile(arg, filePath)
  return result
})

ipcMain.handle('ipc-canmartix-exportOtherFile', async (event, arg) => {
  const tmpDir = app.getPath('temp')
  const fileType = arg.fileType
  const candb = arg.candb
  const outputFilePath = arg.outputFilePath
  await exportOtherFile(tmpDir, fileType, candb, outputFilePath)
})
