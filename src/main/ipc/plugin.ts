import { ipcMain } from 'electron'
import runtimeDom from '../../../resources/lib/js/runtime-dom.esm-browser.min.js?asset&asarUnpack'
import path from 'path'

const libPath = path.dirname(runtimeDom)

ipcMain.on('ipc-plugin-lib-path', async (event, ...arg) => {
  event.returnValue = libPath.replaceAll('\\', '/')
})
