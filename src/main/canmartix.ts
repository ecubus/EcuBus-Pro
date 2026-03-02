import { CanDB } from './share/can'
import { execBinary } from './util'
import { getPythonPath } from './python'
import fsP from 'fs/promises'

export async function parseFile(
  filePath: string,
  outputJsonPath: string
): Promise<{ data: CanDB; msg: string }> {
  const pythonPath = getPythonPath()
  const result = await execBinary(pythonPath, [
    '-m',
    'canmatrix.cli.convert',
    filePath,
    outputJsonPath,
    '--jsonExportAll'
  ])
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
