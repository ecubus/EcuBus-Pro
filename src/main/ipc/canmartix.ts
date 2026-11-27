import { ipcMain, app } from 'electron'
import { exportOtherFile, parseFile } from '../canmartix'
import { randomUUID } from 'crypto'
import path from 'path'
import fs from 'fs'

ipcMain.handle('ipc-canmartix-parse', async (event, arg) => {
  const tmpDir = app.getPath('temp')
  const filePath = path.join(tmpDir, `canmartix_${process.pid}_${Date.now()}_${randomUUID()}.json`)
  try {
    const result = await parseFile(arg, filePath)
    return result
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  }
})

ipcMain.handle('ipc-canmartix-exportOtherFile', async (event, arg) => {
  const tmpDir = app.getPath('temp')
  const fileType = arg.fileType
  const candb = arg.candb
  const outputFilePath = arg.outputFilePath
  await exportOtherFile(tmpDir, fileType, candb, outputFilePath)
})
