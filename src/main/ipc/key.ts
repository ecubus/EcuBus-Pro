import { ipcMain } from 'electron'
import EventEmitter from 'events'

const keyEvent = new EventEmitter()
global.keyEvent = keyEvent

ipcMain.on('ipc-key-down', (event, arg) => {
  keyEvent.emit('keydown', arg)
})
