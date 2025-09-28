import { ipcMain } from 'electron'
import os2block from './../ostrace/os2graph'
import { parseExcelFromFile } from './../ostrace/table2event'

ipcMain.handle('ipc-ostrace-parse-excel', async (event, ...arg) => {
  const events = await parseExcelFromFile(arg[0])
  return os2block(events)
})
