import { ipcMain } from 'electron'
import { Python } from '../python'
import pyFIle from '../odx/odxparse.py?asset'

const odxPy: Record<string, Python> = {}
ipcMain.handle('ipcOdxParse', async (event, id, filePath) => {
  const py = new Python(pyFIle, undefined, { restartable: true, retryTimers: 5 })
  if (odxPy[id]) {
    odxPy[id].kill()
  }
  odxPy[id] = py
  return JSON.parse(await py.send('parse', filePath))
})
ipcMain.on('ipcCloseOdxParse', (event, id) => {
  if (!odxPy[id]) return
  odxPy[id].kill()
  delete odxPy[id]
})
