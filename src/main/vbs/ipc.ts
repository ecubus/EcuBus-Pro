import { ipcMain } from 'electron'
import fsP from 'fs/promises'
import fs from 'fs'
import path from 'path'
import { XMLParser } from 'fast-xml-parser'
import antlr4 from 'antlr4'
import parse from './g4/parse.js'

ipcMain.handle('ipc-vbs-parse-xml', async (event, ...arg) => {
  const projectPath = arg[0]
  let filePath = arg[1]
  if (!path.isAbsolute(filePath)) {
    filePath = path.join(projectPath, filePath)
  }
  if (fs.existsSync(filePath)) {
    //
    const contet = await fsP.readFile(filePath, 'utf-8')
    const parser = new XMLParser()
    return parser.parse(contet)
  } else {
    throw new Error(`${filePath} doesn't exits`)
  }
})
ipcMain.handle('ipc-vbs-parse-idl', async (event, ...arg) => {
  const projectPath = arg[0]
  let filePath = arg[1]
  if (!path.isAbsolute(filePath)) {
    filePath = path.join(projectPath, filePath)
  }
  if (fs.existsSync(filePath)) {
    //
    const contet = await fsP.readFile(filePath, 'utf-8')
    return parse(contet)
  } else {
    throw new Error(`${filePath} doesn't exits`)
  }
})
