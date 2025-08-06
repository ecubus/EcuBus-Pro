import dllLib from '../../resources/lib/zlgcan.dll?asset&asarUnpack'
import esbuild from '../../resources/bin/esbuild?asset&asarUnpack'

let esbuild_executable = esbuild
if (process.platform === 'win32') {
  esbuild_executable = `${esbuild}.exe`
}

import path from 'path'
import { DataSet } from 'src/preload/data'
import { compileTsc, getBuildStatus } from 'src/main/docan/uds'
import { exit } from 'process'

const libPath = path.dirname(dllLib)

export async function build(
  projectPath: string,
  projectName: string,
  data: DataSet,
  entry: string,
  isTest: boolean
) {
  sysLog.debug(`start to build ${entry}`)
  const result = await compileTsc(
    projectPath,
    projectName,
    data,
    entry,
    esbuild_executable,
    path.join(libPath, 'js'),
    isTest
  )
  if (result.length > 0) {
    for (const err of result) {
      sysLog.error(`${err.file}:${err.line} build error: ${err.message}`)
    }
    exit(-1)
  } else {
    sysLog.debug(`build ${entry} success`)
  }
}

export async function getBuild(projectPath: string, projectName: string, entry: string) {
  return getBuildStatus(projectPath, projectName, entry)
}

