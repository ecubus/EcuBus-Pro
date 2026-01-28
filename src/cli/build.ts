import dllLib from '../../resources/lib/zlgcan.dll?asset&asarUnpack'
import esbuild from '../../resources/bin/esbuild.exe?asset&asarUnpack'

// Disable javascript-obfuscator banner/advertisement messages
process.env.BUILDKITE = '1'
import JavaScriptObfuscator from 'javascript-obfuscator'

let esbuild_executable = esbuild
if (process.platform === 'darwin') {
  esbuild_executable = esbuild.replace('.exe', '_mac')
} else if (process.platform === 'linux') {
  esbuild_executable = esbuild.replace('.exe', '_linux')
}

import path from 'path'
import fs from 'fs'
import fsP from 'fs/promises'
import { DataSet } from 'src/preload/data'
import { compileTsc, getBuildStatus } from 'src/main/docan/uds'
import { exit } from 'process'

const libPath = path.dirname(dllLib)

export interface BuildOptions {
  isTest?: boolean
  obfuscate?: boolean
  outputDir?: string
}

/**
 * Obfuscate JavaScript code using javascript-obfuscator
 */
async function obfuscateCode(jsFilePath: string): Promise<void> {
  const code = await fsP.readFile(jsFilePath, 'utf-8')

  const obfuscatedCode = JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: false,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: false,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.75,
    stringArrayEncoding: ['base64'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 2,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 4,
    stringArrayWrappersType: 'function',
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
  }).getObfuscatedCode()

  await fsP.writeFile(jsFilePath, obfuscatedCode)
}

export async function build(
  projectPath: string,
  projectName: string,
  data: DataSet,
  entry: string,
  options: BuildOptions = {}
) {
  const { isTest = false, obfuscate = false, outputDir } = options

  sysLog.debug(`start to build ${entry}`)
  sysLog.debug(`options: obfuscate=${obfuscate}`)

  const result = await compileTsc(
    projectPath,
    projectName,
    data,
    entry,
    esbuild_executable,
    path.join(libPath, 'js'),
    isTest
  )

  if (result && result.length > 0) {
    for (const err of result) {
      sysLog.error(`${err.file}:${err.line} build error: ${err.message}`)
    }
    exit(-1)
  }

  // Get the output JS file path
  const defaultOutputDir = path.join(projectPath, '.ScriptBuild')
  const actualOutputDir = outputDir ? path.join(projectPath, outputDir) : defaultOutputDir
  const jsFileName = path.basename(entry).replace(/\.ts$/, '.js')
  let jsFilePath = path.join(defaultOutputDir, jsFileName)

  // If custom output dir, copy the file
  if (outputDir && actualOutputDir !== defaultOutputDir) {
    await fsP.mkdir(actualOutputDir, { recursive: true })
    const targetPath = path.join(actualOutputDir, jsFileName)
    await fsP.copyFile(jsFilePath, targetPath)
    // Also copy .map file if exists
    const mapFile = jsFilePath + '.map'
    if (fs.existsSync(mapFile)) {
      await fsP.copyFile(mapFile, targetPath + '.map')
    }
    jsFilePath = targetPath
  }

  // Apply obfuscation if requested
  if (obfuscate) {
    sysLog.info('Obfuscating code with javascript-obfuscator...')
    try {
      await obfuscateCode(jsFilePath)
      // Remove sourcemap since it won't be valid after obfuscation
      const mapFile = jsFilePath + '.map'
      if (fs.existsSync(mapFile)) {
        await fsP.rm(mapFile)
      }
      sysLog.info('Code obfuscated successfully')
    } catch (e: any) {
      sysLog.error(`Obfuscation failed: ${e.message}`)
      exit(-1)
    }
  }

  sysLog.info(`Build completed: ${jsFilePath}`)
}

export async function getBuild(projectPath: string, projectName: string, entry: string) {
  return getBuildStatus(projectPath, projectName, entry)
}
