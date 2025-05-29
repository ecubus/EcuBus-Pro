import { ipcMain } from 'electron'
import fsP from 'fs/promises'
import fs from 'fs'
import path from 'path'
// import { parseXml, parseIdl } from './parse'

// ipcMain.handle('ipc-vbs-parse-xml', async (event, ...arg) => {
//   const projectPath = arg[0]
//   let filePath = arg[1]
//   if (!path.isAbsolute(filePath)) {
//     filePath = path.join(projectPath, filePath)
//   }
//   if (fs.existsSync(filePath)) {
//     return parseXml(filePath)
//   } else {
//     throw new Error(`${filePath} doesn't exits`)
//   }
// })
// ipcMain.handle('ipc-vbs-parse-idl', async (event, ...arg) => {
//   const projectPath = arg[0]
//   let filePath = arg[1]
//   if (!path.isAbsolute(filePath)) {
//     filePath = path.join(projectPath, filePath)
//   }
//   if (fs.existsSync(filePath)) {
//     return parseIdl(filePath)
//   } else {
//     throw new Error(`${filePath} doesn't exits`)
//   }
// })
