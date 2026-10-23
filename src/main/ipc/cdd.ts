import { ipcMain, app } from 'electron'
import fsP from 'fs/promises'
import path from 'path'

import { getPythonPath } from '../python'
import { execBinary } from '../util'
import cddPyFile from '../../../resources/cdd/cddparse.py?asset&asarUnpack'

async function runCddParse(
  command: string,
  cddFilePath: string,
  parseResp: boolean
): Promise<{ error: number; data?: any; message?: string }> {
  const pythonPath = getPythonPath()
  const tmpDir = await fsP.mkdtemp(path.join(app.getPath('temp'), 'cdd-'))
  const outputPath = path.join(tmpDir, 'result.json')

  const args = [cddPyFile, command, cddFilePath, outputPath]
  if (parseResp) {
    args.push('--parseResp')
  }

  try {
    const result = await execBinary(pythonPath, args, {
      cwd: path.dirname(cddPyFile)
    })
    if (result.success) {
      const jsonStr = await fsP.readFile(outputPath, 'utf-8')
      return JSON.parse(jsonStr)
    } else {
      throw new Error(result.stderr || 'CDD parse failed')
    }
  } finally {
    await fsP.unlink(outputPath).catch(() => {})
    await fsP.rmdir(tmpDir).catch(() => {})
  }
}

ipcMain.handle('ipcCddParse', async (_event, _id: string, filePath: string) => {
  return runCddParse('parse', filePath, false)
})

ipcMain.handle(
  'ipcCddParseTesterInfo',
  async (_event, _id: string, filePath: string, parseResp = true) => {
    return runCddParse('parseTesterInfo', filePath, parseResp)
  }
)
