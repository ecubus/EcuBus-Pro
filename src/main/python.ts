import path from 'path'
import { PythonShell, Options, PythonShellError } from 'python-shell'
import fs from 'fs'

import pythonRequirements from '../../resources/requirements.txt?asset&asarUnpack'

export function getPythonPath(): string {
  const baseDir = path.dirname(pythonRequirements)
  const pythonDir = path.join(baseDir, 'python')
  if (process.platform === 'win32') {
    return path.join(pythonDir, 'python.exe')
  }
  // darwin (macOS) and linux: python-build-standalone uses bin/python3
  return path.join(pythonDir, 'bin', 'python3')
}
