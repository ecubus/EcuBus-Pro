import { ipcMain } from 'electron'
import { SerialPort } from 'serialport'

ipcMain.handle('ipc-get-serial-port-list', async (event, ...arg) => {
  return await SerialPort.list()
})
