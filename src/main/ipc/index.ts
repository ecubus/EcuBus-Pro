import './odx'
import './dialog'
import './uds'
import './fs'
import './examples'
import './key'
import './pnpm'
import './var'
import './serialPort'
import './ostrace'
import './plugin'
import './axios'
import './i18n'
import { ipcMain, shell } from 'electron'
import { getCanVersion } from '../docan/can'
import { getLinVersion } from '../dolin'
import { error } from 'electron-log'
import { platform } from 'process'
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
  const vendors = input.vendor[platform] || []
  for (const vendor of vendors) {
    try {
      list.push({
        name: `${vendor} can`,
        version: getCanVersion(vendor)
      })
    } catch (e: any) {
      error(e)
      list.push({
        name: `${vendor} can`,
        version: 'Failed to get version'
      })
    }
  }
  for (const vendor of vendors) {
    try {
      list.push({
        name: `${vendor} lin`,
        version: getLinVersion(vendor)
      })
    } catch (e: any) {
      error(e)
      list.push({
        name: `${vendor} lin`,
        version: 'Failed to get version'
      })
    }
  }

  return list
})

ipcMain.on('ipc-open-um', (event, arg) => {
  shell.openExternal('https://app.whyengineer.com')
})

ipcMain.handle('ipc-get-vendor', (event, arg) => {
  const input = arg as EcuBusPro
  const vendors = input.vendor[platform] || []
  return vendors.map((vendor) => {
    let linVersion = 'Not supported'
    try {
      linVersion = getLinVersion(vendor)
    } catch (e: any) {
      //null
    }
    let canVersion = 'Not supported'
    try {
      canVersion = getCanVersion(vendor)
    } catch (e: any) {
      //null
    }
    return {
      name: vendor,
      can: canVersion,
      lin: linVersion
    }
  })
})
