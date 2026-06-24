import { ipcMain } from 'electron'
import { SerialPort } from 'serialport'
import { SerialDevice } from '../share/serial'

ipcMain.handle('ipc-get-serial-port-list', async (event, ...arg) => {
  return await SerialPort.list()
})

ipcMain.handle('ipc-get-serial-devices', async (): Promise<SerialDevice[]> => {
  const ports = await SerialPort.list()
  return ports.map((p) => ({
    label: p.friendlyName || p.path,
    id: p.path,
    handle: p.path,
    serialNumber: p.serialNumber
  }))
})
