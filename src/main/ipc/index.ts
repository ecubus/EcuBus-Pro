import './odx'
import './dialog'
import './uds'
import './fs'
import './examples'
import './key'
import './pnpm'
import './var'
import { ipcMain, shell } from 'electron'
import { getCanVersion } from '../docan/can'
import { getLinVersion } from '../dolin'

interface EcuBusPro {
  support: string[]
  vendor: Record<string, string[]>
}

ipcMain.handle('ipc-get-version', async (event, arg) => {
  const input = arg as EcuBusPro
  const list: {
    name: string
    version: string
  }[] = []
  list.push({
    name: 'Electron',
    version: process.versions.electron
  })
  list.push({
    name: 'Chrome',
    version: process.versions.chrome
  })
  for (const v of input.support) {
    for (const vendor of input.vendor[v]) {
      list.push({
        name: `${vendor} can`,
        version: getCanVersion(vendor)
      })
    }
    for (const vendor of input.vendor[v]) {
      list.push({
        name: `${vendor} lin`,
        version: getLinVersion(vendor)
      })
    }
  }
  return list
})

ipcMain.on('ipc-open-um', (event, arg) => {
  shell.openExternal('https://app.whyengineer.com')
})
