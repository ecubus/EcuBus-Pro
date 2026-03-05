import { ipcMain } from 'electron'
import { getPythonPath } from '../python'
import { execBinary } from '../util'
import fsP from 'fs/promises'
import path from 'path'
import { app } from 'electron'
import odxPyFile from '../../../resources/odx/odxparse.py?asset&asarUnpack'

async function runOdxParse(
  command: string,
  odxFilePath: string,
  parseResp: boolean
): Promise<{ error: number; data?: any; message?: string }> {
  const pythonPath = getPythonPath()
  const tmpDir = app.getPath('temp')
  const outputPath = path.join(tmpDir, `odx_result_${Date.now()}.json`)

  const args = [odxPyFile, command, odxFilePath, outputPath]
  if (parseResp) {
    args.push('--parseResp')
  }

  const result = await execBinary(pythonPath, args)

  try {
    if (result.success) {
      const jsonStr = await fsP.readFile(outputPath, 'utf-8')
      return JSON.parse(jsonStr)
    } else {
      throw new Error(result.stderr || 'ODX parse failed')
    }
  } finally {
    fsP.unlink(outputPath).catch(() => {})
  }
}

ipcMain.handle('ipcOdxParse', async (_event, _id: string, filePath: string) => {
  return runOdxParse('parse', filePath, false)
})

ipcMain.handle(
  'ipcOdxParseTesterInfo',
  async (_event, _id: string, filePath: string, parseResp = true) => {
    return runOdxParse('parseTesterInfo', filePath, parseResp)
  }
)
