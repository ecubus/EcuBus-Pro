import { TesterInfo } from 'nodeCan/tester'
import { exit } from 'process'
import { UdsLOG } from 'src/main/log'
import { NodeClass } from 'src/main/nodeItem'
import { getJsPath } from 'src/main/util'
import { DataSet, NodeItem } from 'src/preload/data'
import deviceMain, { closeDevice } from './device'
import { DOIP } from 'src/main/doip'
import path from 'path'
import fsP from 'fs/promises'
import { build, getBuild } from './build'
import type { TestEvent } from 'node:test/reporters'

export default async function main(
  projectPath: string,
  projectName: string,
  data: DataSet,
  testName: string,
  reportPath?: string,
  forceBuild?: boolean,
  justShowTree?: boolean
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
    sysLog.info(`force build ${testItem.script}`)
    await build(projectPath, projectName, data, testItem.script, true)
  }
  const { canBaseMap, linBaseMap, ethBaseMap, pwmBaseMap } = await deviceMain(
    projectPath,
    projectName,
    data.devices
  )

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
    testItem,
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

  await node.start({})
  let testInfo: TestEvent[] | undefined = undefined

  try {
    testInfo = await node.getTestInfo()
  } catch (e) {
    sysLog.error(`get test info failed:${e}`)
    exit(-1)
  }

  if (!testInfo) {
    sysLog.error(`test info is undefined`)
    exit(-1)
  }

  if (justShowTree) {
    sysLog.info(`test tree:`, testInfo)
    // Print test tree structure to terminal
    // printTestTree(testInfo)
    node.close()
    await closeDevice(canBaseMap, linBaseMap, ethBaseMap, pwmBaseMap)
    return
  }

  node.close()

  if (reportPath) {
    const html = await node.generateHtml(reportPath, true)
    reportPath = path.join(process.cwd(), reportPath)
    await fsP.writeFile(reportPath, html)
    sysLog.info(`test report saved to ${reportPath}`)
  }
  await closeDevice(canBaseMap, linBaseMap, ethBaseMap, pwmBaseMap)
}

// Tree structure interface (similar to TestTree in Vue component)
interface TestTreeNode {
  id: string
  type: string
  label: string
  nesting?: number
  children: TestTreeNode[]
  parent?: TestTreeNode
}

// Build tree structure from test events (adapted from test.vue buildSubTree function)
function buildSubTree(infos: TestEvent[]): TestTreeNode[] {
  let currentSuite: TestTreeNode | undefined
  const roots: TestTreeNode[] = []

  function startTest(event: any) {
    const originalSuite = currentSuite
    const testId = `${event.name}:${event.line || 0}:${event.column || 0}`

    currentSuite = {
      id: testId,
      type: 'test',
      label: event.name,
      nesting: event.nesting,
      parent: currentSuite,
      children: []
    }

    if (originalSuite?.children) {
      originalSuite.children.push(currentSuite)
    }

    if (!currentSuite.parent) {
      roots.push(currentSuite)
    }
  }

  for (const event of infos) {
    switch (event.type) {
      case 'test:dequeue': {
        startTest(event.data)
        break
      }
      case 'test:pass':
      case 'test:fail': {
        if (!currentSuite) {
          startTest({ name: 'root', nesting: 0, line: 0, column: 0 })
        }
        if (
          currentSuite!.label !== event.data.name ||
          currentSuite!.nesting !== event.data.nesting
        ) {
          startTest(event.data)
        }

        if (currentSuite?.nesting === event.data.nesting) {
          currentSuite = currentSuite.parent
        }
        break
      }
    }
  }

  return roots
}

// Print tree structure to terminal with proper indentation
function printTreeNode(node: TestTreeNode, indent: string = '', isLast: boolean = true) {
  const prefix = isLast ? '└── ' : '├── '
  const connector = isLast ? '    ' : '│   '

  console.log(`${indent}${prefix}${node.label}`)

  if (node.children && node.children.length > 0) {
    node.children.forEach((child, index) => {
      const isLastChild = index === node.children.length - 1
      printTreeNode(child, indent + connector, isLastChild)
    })
  }
}

// Main function to print test tree (similar to Vue component logic)
function printTestTree(testInfo: (TestEvent | string)[] | undefined) {
  if (!testInfo || testInfo.length === 0) {
    console.log('No tests found.')
    return
  }

  // Filter out internal test markers and ensure we only work with TestEvent objects
  const filteredTestInfo = testInfo.filter(
    (item: any) =>
      typeof item === 'object' && item.data && item.data.name !== '____ecubus_pro_test___'
  ) as TestEvent[]

  if (filteredTestInfo.length === 0) {
    console.log('No tests found.')
    return
  }

  const roots = buildSubTree(filteredTestInfo)

  console.log('\nTest Structure:')
  console.log('==============')

  if (roots.length === 0) {
    console.log('No test structure found.')
    return
  }

  roots.forEach((root, index) => {
    const isLast = index === roots.length - 1
    printTreeNode(root, '', isLast)
  })

  console.log('') // Add empty line at the end
}
