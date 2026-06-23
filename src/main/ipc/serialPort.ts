import { ipcMain } from 'electron'
import { SerialPort } from 'serialport'
import { SerialDevice } from '../share/serial'

ipcMain.handle('ipc-get-serial-port-list', async (event, ...arg) => {
  return await SerialPort.list()
})

ipcMain.handle('ipc-get-serial-devices', async (event, ...arg) => {
  const ports = await SerialPort.list()
  const devices: SerialDevice[] = ports.map((p) => ({
    label: p.friendlyName || p.path,
    id: p.serialNumber || p.path,
    handle: p.path
  }))
  return devices
})
