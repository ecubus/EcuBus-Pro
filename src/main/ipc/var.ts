import { ipcMain } from 'electron'
import EventEmitter from 'events'
import { VarEvent } from '../global'

const varEvent = new EventEmitter<VarEvent>()
global.varEvent = varEvent

ipcMain.on('ipc-var-set', (event, arg) => {
  varEvent.emit('update', {
    name: arg.name,
    value: arg.value,
    id: arg.id,
    uuid: arg.uuid
  })
})
