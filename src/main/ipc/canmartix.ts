import { ipcMain, app } from 'electron'
import { parseFile } from '../canmartix'
import path from 'path'

ipcMain.handle('ipc-canmartix-parse', async (event, arg) => {
  const result = await parseFile(arg, path.join(app.getPath('temp'), 'canmartix.json'))
  return result
})
