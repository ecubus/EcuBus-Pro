import path from 'path'
import { spawn } from 'child_process'
// import type { Signal } from 'src/renderer/src/database/dbc/dbcVisitor'
import { updateSignalPhys, updateSignalRaw } from 'src/renderer/src/database/dbc/calc'
import type { LDF } from 'src/renderer/src/database/ldfParse'
import { isEqual } from 'lodash'
import { Signal as CanSignal } from 'nodeCan/can'
import { getPhysicalValue, getRawValue } from 'src/renderer/src/database/ldf/calc'
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

export interface ExecResult {
  success: boolean
  stdout: string
  stderr: string
}

/**
 * Async execution of an external binary.
 * @param command - Path to the executable
 * @param args - Command line arguments
 * @param options - Optional cwd, env, timeout (ms)
 * @returns success, all stdout, stderr (or error message)
 */
export async function execBinary(
  command: string,
  args: string[] = [],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number }
): Promise<ExecResult> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []

    const proc = spawn(command, args, {
      cwd: options?.cwd,
      env: { ...process.env, ...options?.env }
    })

    proc.stdout?.on('data', (data: Buffer) => chunks.push(data))
    proc.stderr?.on('data', (data: Buffer) => errChunks.push(data))

    let timedOut = false
    const timeoutId = options?.timeout
      ? setTimeout(() => {
          timedOut = true
          proc.kill('SIGTERM')
        }, options.timeout)
      : null

    proc.on('close', (code, signal) => {
      if (timeoutId) clearTimeout(timeoutId)

      const stdout = Buffer.concat(chunks).toString('utf8')
      let stderr = Buffer.concat(errChunks).toString('utf8')

      if (timedOut) {
        stderr = (stderr ? stderr + '\n' : '') + `Process timed out after ${options!.timeout}ms`
      } else if (signal) {
        stderr = (stderr ? stderr + '\n' : '') + `Process killed with signal: ${signal}`
      } else if (code !== 0 && !stderr) {
        stderr = `Process exited with code ${code}`
      }

      resolve({
        success: !timedOut && code === 0 && !signal,
        stdout,
        stderr
      })
    })

    proc.on('error', (err) => {
      if (timeoutId) clearTimeout(timeoutId)
      resolve({
        success: false,
        stdout: Buffer.concat(chunks).toString('utf8'),
        stderr: err.message
      })
    })
  })
}

/**
 * Returns the path to a pip-installed script/executable.
 * - Windows: python/Scripts/<scriptName>.exe
 * - macOS/Linux: python/bin/<scriptName>
 */
export function getPythonScriptPath(scriptName: string, pythonDir?: string): string {
  if (!pythonDir) {
    const baseDir = path.dirname(pythonRequirements)
    pythonDir = path.join(baseDir, 'python')
  }
  if (process.platform === 'win32') {
    const name = scriptName.endsWith('.exe') ? scriptName : `${scriptName}.exe`
    return path.join(pythonDir, 'Scripts', name)
  }
  return path.join(pythonDir, 'bin', scriptName)
}

export function updateLinSignalVal(db: LDF, signalName: string, value: number | number[] | string) {
  const signal = db.signals[signalName]
  if (signal) {
    //compare value
    const lastValue = signal.value != undefined ? signal.value : signal.initValue
    if (!isEqual(lastValue, value)) {
      signal.update = true
    }
    const encodingType = Object.entries(db.signalRep).find(([_, signals]) =>
      signals.includes(signalName)
    )?.[0]
    if (typeof value === 'string') {
      //find in encode

      if (!encodingType) {
        throw new Error(`Signal ${signalName} does not have encoding type`)
      }
      signal.physValue = value
      const encodeInfo = db.signalEncodeTypes[encodingType]
      const val = getRawValue(value, encodeInfo.encodingTypes, db)
      signal.value = val.value
    } else {
      signal.value = value
      if (encodingType && typeof value === 'number') {
        const encodeInfo = db.signalEncodeTypes[encodingType]
        const val = getPhysicalValue(value, encodeInfo.encodingTypes, db)
        signal.physValue = val.numVal?.toString()
      }
    }
  }
}

export function getJsPath(tsPath: string, projectPath: string) {
  const outDir = path.join(projectPath, '.ScriptBuild')
  const scriptNameNoExt = path.basename(tsPath, '.ts')
  const jsPath = path.join(outDir, scriptNameNoExt + '.js')
  return jsPath
}

export function setSignal(data: { signal: string; value: number | number[] | string }) {
  const s = data.signal.split('.')
  // 验证数据库是否存在
  const db = Object.values(global.dataSet.database.can).find((db) => db.name == s[0])
  if (db) {
    const signalName = s[1]
    let ss: CanSignal | undefined
    for (const msg of Object.values(db.messages)) {
      for (const signal of Object.values(msg.signals)) {
        if (signal.name == signalName) {
          ss = signal
          break
        }
      }
      if (ss) {
        break
      }
    }
    if (!ss) {
      throw new Error(`Signal ${signalName} not found`)
    }
    if (typeof data.value === 'string') {
      ss.physValue = data.value
      updateSignalPhys(ss, db)
    } else {
      if (Array.isArray(data.value)) {
        throw new Error('Can not set array value')
      }
      ss.value = data.value.toString()
      updateSignalRaw(ss)
    }
  } else {
    const linDb = Object.values(global.dataSet.database.lin).find((db) => db.name == s[0])
    if (linDb) {
      const signalName = s[1]

      const signal = linDb.signals[signalName]
      if (!signal) {
        throw new Error(`Signal ${signalName} not found`)
      }
      // 更新信号值
      updateLinSignalVal(linDb, signalName, data.value)
    }
  }
}
