import { ipcMain } from 'electron'
import EventEmitter from 'events'
import { VarEvent } from '../global'
import { VarLOG } from '../log'
import { getTsUs } from '../share/can'
import { setSignal } from '../util'
import { setVar } from '../var'
const varEvent = new EventEmitter<VarEvent>()
global.varEvent = varEvent

let varLOG: VarLOG | undefined
ipcMain.on('ipc-var-set', (event, arg) => {
  if (!varLOG) {
    varLOG = new VarLOG('frontVar')
  }
  const { found, target } = setVar(arg.name, arg.value)
  const dataVar = found && target?.id ? global.dataSet?.vars?.[target.id] : undefined
  if (dataVar?.value) {
    dataVar.value.value = arg.value
  }
  varLOG.setVar(arg.name, arg.value, getTsUs() - global.startTs)
})
ipcMain.on('ipc-signal-set', (event, arg) => {
  setSignal({
    signal: arg.name,
    value: arg.value
  })
})
