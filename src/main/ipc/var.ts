import { ipcMain } from 'electron'
import EventEmitter from 'events'
import { VarEvent } from '../global'
import { VarLOG } from '../log'
import { getTsUs } from '../share/can'
import { NodeClass } from '../nodeItem'
const varEvent = new EventEmitter<VarEvent>()
global.varEvent = varEvent

let varLOG: VarLOG | undefined
ipcMain.on('ipc-var-set', (event, arg) => {
  if (!varLOG) {
    varLOG = new VarLOG('frontVar')
  }
  varLOG.setVar(arg.name, arg.value, getTsUs() - global.startTs)
})
ipcMain.on('ipc-signal-set', (event, arg) => {
  NodeClass.setSignal(null as any, {
    signal: arg.name,
    value: arg.value
  })
})

