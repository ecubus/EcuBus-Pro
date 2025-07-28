import { TesterInfo } from 'nodeCan/tester'
import { exit } from 'process'
import { UdsLOG } from 'src/main/log'
import { NodeClass } from 'src/main/nodeItem'
import { getJsPath } from 'src/main/util'
import { DataSet, NodeItem } from 'src/preload/data'
import deviceMain from './device'
import { DOIP } from 'src/main/doip'
import path from 'path'
import fsP from 'fs/promises'
import { build, getBuild } from './build'

export default async function main(
  projectPath: string,
  projectName: string,
  data: DataSet,
  testName: string,
  reportPath?: string,
  forceBuild?: boolean
) {
  //find tester by name
  const testItem = Object.values(data.nodes).find((t) => t.name == testName && t.isTest)
  if (!testItem) {
    sysLog.error(`test config ${testName} not found`)
    exit(-1)
  }
  if (testItem.script == undefined) {
    sysLog.error(`test config ${testName} script is required`)
    exit(-1)
  }
  const status = await getBuild(projectPath, projectName, testItem.script)
  if (status != 'success') {
    forceBuild = true
  }

  if (forceBuild) {
    await build(projectPath, projectName, data, testItem.script, true)
  }
  const { canBaseMap, linBaseMap, ethBaseMap, pwmBaseMap } = await deviceMain(
    projectPath,
    projectName,
    data.devices
  )

  const nodeItem: NodeItem = {
    id: testItem.id,
    name: testItem.name,
    channel: testItem.channel,
    script: testItem.script
  }
  const doips: DOIP[] = []
  for (const tester of Object.values(data.tester)) {
    if (tester.type == 'eth') {
      for (const val of ethBaseMap.values()) {
        const doip = new DOIP(val, tester)
        doips.push(doip)
      }
    }
  }

  const node = new NodeClass(
    nodeItem,
    canBaseMap,
    linBaseMap,
    doips,
    ethBaseMap,
    pwmBaseMap,
    projectPath,
    projectName,
    data.tester,
    {
      id: testItem.id
    }
  )

  await node.start()
  await node.getTestInfo()
  node.close()
  if (reportPath) {
    const html = await node.generateHtml(reportPath, true)
    reportPath = path.join(process.cwd(), reportPath)
    await fsP.writeFile(reportPath, html)
    sysLog.info(`test report saved to ${reportPath}`)
  }
}
