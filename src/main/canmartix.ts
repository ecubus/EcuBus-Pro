import { CanDB } from './share/can'
import { execBinary } from './util'
import { getPythonPath } from './python'
import fsP from 'fs/promises'
import path from 'path'

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
    if (result.stdout.toLowerCase().includes('error')) {
      throw new Error(result.stdout)
    }
    if (result.stderr.toLowerCase().includes('error')) {
      throw new Error(result.stderr)
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

export async function exportOtherFile(
  tmpDir: string,
  fileType: string,
  candb: CanDB,
  outputFilePath: string
): Promise<void> {
  //covert candb to json firstly, then conver the json file to the other file
  const jsonFilePath = path.join(tmpDir, 'canmatrix.json')
  await fsP.writeFile(jsonFilePath, JSON.stringify(candb, null, 2))
  const pythonPath = getPythonPath()
  // Omit -f to infer format from output path extension; avoids KeyError when a
  // format module failed to load (e.g. arxml when lxml is missing)
  const result = await execBinary(pythonPath, [
    '-m',
    'canmatrix.cli.convert',
    jsonFilePath,
    outputFilePath
  ])
  if (result.success) {
    if (result.stdout.toLowerCase().includes('error')) {
      throw new Error(result.stdout)
    }
    if (result.stderr.toLowerCase().includes('error')) {
      throw new Error(result.stderr)
    }
  } else {
    throw new Error(result.stderr)
  }
}
