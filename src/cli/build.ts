import dllLib from '../../resources/lib/zlgcan.dll?asset&asarUnpack'
import esbuild from '../../resources/bin/esbuild.exe?asset&asarUnpack'

let esbuild_executable = esbuild
if (process.platform === 'darwin') {
  esbuild_executable = esbuild.replace('.exe', '_mac')
} else if (process.platform === 'linux') {
  esbuild_executable = esbuild.replace('.exe', '_linux')
}

import path from 'path'
import fs from 'fs'
import fsP from 'fs/promises'
import util from 'util'
import { exec as execCb } from 'child_process'
import { DataSet } from 'src/preload/data'
import { compileTsc, getBuildStatus } from 'src/main/docan/uds'
import { exit } from 'process'

const exec = util.promisify(execCb)

const libPath = path.dirname(dllLib)

export interface BuildOptions {
  isTest?: boolean
  obfuscate?: boolean
  outputDir?: string
}

/**
 * Obfuscate JavaScript code using esbuild minification
 */
async function obfuscateCode(
  jsFilePath: string,
  esbuildPath: string,
  projectPath: string
): Promise<void> {
  const outputPath = jsFilePath.replace(/\.js$/, '.min.js')

  const args = [
    `"${jsFilePath}"`,
    '--minify',
    '--keep-names=false',
    '--target=node18',
    `--outfile="${outputPath}"`,
    '--platform=node',
    '--format=cjs'
  ].join(' ')

  const cmd = `"${path.resolve(esbuildPath)}" ${args}`

  const { stderr } = await exec(cmd, { cwd: projectPath })

  if (stderr && !stderr.includes('Done')) {
    throw new Error(`Obfuscation failed: ${stderr}`)
  }

  // Replace original file with minified version
  await fsP.rename(outputPath, jsFilePath)
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
    sysLog.info('Obfuscating code with esbuild minification...')
    try {
      await obfuscateCode(jsFilePath, esbuild_executable, projectPath)
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
