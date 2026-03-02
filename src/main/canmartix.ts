import { CanDB } from './share/can'
import { execBinary, getPythonPath, getPythonScriptPath } from './util'
import fsP from 'fs/promises'

export async function parseFile(
  filePath: string,
  outputJsonPath: string
): Promise<{ data: CanDB; msg: string }> {
  const pythonPath = getPythonScriptPath('canconvert')
  const result = await execBinary(pythonPath, [filePath, outputJsonPath, '--jsonExportAll'])
  if (result.success) {
    if (result.stdout.includes('error')) {
      throw new Error(result.stdout)
    }
    const json = await fsP.readFile(outputJsonPath, 'utf-8')
    return {
      data: JSON.parse(json),
      msg: result.stdout
    }
  } else {
    throw new Error(result.stderr)
  }
}
