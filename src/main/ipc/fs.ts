import { ipcMain, shell } from 'electron'
import { glob } from 'glob'
import fsP from 'fs/promises'
import fs from 'fs'
import path from 'path'

ipcMain.on('ipc-path-parse', async (event, arg) => {
  event.returnValue = path.parse(arg)
})
ipcMain.on('ipc-path-relative', async (event, ...args) => {
  event.returnValue = path.relative(args[0], args[1])
})
ipcMain.handle('ipc-glob', async (event, ...args) => {
  const par = args.shift()
  return glob(par, ...args)
})

ipcMain.handle('ipc-fs-readFile', async (event, ...args) => {
  return fsP.readFile(args[0], 'utf-8')
})

ipcMain.handle('ipc-fs-writeFile', async (event, ...args) => {
  const v = args[1]
  if (typeof v !== 'string') {
    args[1] = JSON.stringify(v, null, 2)
  }
  return fsP.writeFile(args[0], args[1])
})

ipcMain.handle('ipc-fs-readdir', async (event, ...args) => {
  return fsP.readdir(args[0], { withFileTypes: true })
})
ipcMain.handle('ipc-fs-mkdir', async (event, ...args) => {
  const dir = args[0]
  return fsP.mkdir(dir, { recursive: true })
})

ipcMain.handle('ipc-fs-exist', async (event, ...args) => {
  return fs.existsSync(args[0])
})
ipcMain.handle('ipc-fs-stat', async (event, ...args) => {
  return fsP.stat(args[0])
})
