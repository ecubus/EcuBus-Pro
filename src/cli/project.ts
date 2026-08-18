import path from 'path'
import fsP from 'fs/promises'
import fs from 'fs'
import { cloneDeep } from 'lodash'
import { DataSet, VarItem } from 'src/preload/data'
import { getAllSysVar } from '../main/share/sysVar'

export async function parseProject(projectPath: string): Promise<{
  data: DataSet
  projectPath: string
  projectName: string
}> {
  if (!path.isAbsolute(projectPath)) {
    projectPath = path.join(process.cwd(), projectPath)
  }
  if (!fs.existsSync(projectPath)) {
    throw new Error(`project file ${projectPath} not found`)
  }

  try {
    const content = await fsP.readFile(projectPath, 'utf-8')
    const data1 = JSON.parse(content)
    const info = path.parse(projectPath)
    global.dataSet = data1.data as DataSet
    global.vars = {}

    const vars: Record<string, VarItem> = cloneDeep(global.dataSet.vars)
    const sysVars = getAllSysVar(
      global.dataSet.devices,
      global.dataSet.tester,
      global.dataSet.database.orti
    )
    for (const v of Object.values(sysVars)) {
      vars[v.id] = cloneDeep(v)
    }
    for (const key of Object.keys(vars)) {
      const v = vars[key]

      if (v.value) {
        const parentName: string[] = []

        let currentVar = v
        while (currentVar.parentId) {
          const parent = vars[currentVar.parentId]
          if (parent) {
            parentName.unshift(parent.name)
            currentVar = parent
          } else {
            break
          }
        }

        parentName.push(v.name)
        v.name = parentName.join('.')
      }
      global.vars[key] = v
    }

    return {
      data: global.dataSet,
      projectPath: info.dir,
      projectName: info.base
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('project file')) {
      throw e
    }
    throw new Error(`project file ${projectPath} is not a valid file`)
  }
}
