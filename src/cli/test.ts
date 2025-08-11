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
  justShowTree?: boolean,
  pattern?: string
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
      testOnly: true,
      id: testItem.id
    }
  )
  //surpress log this stage
  node.log!.log.silent = true

  await node.start({})
  let testInfo: TestEvent[] | undefined = undefined

  try {
    testInfo = await node.getTestInfo()
  } catch (e) {
    exit(-1)
  }
  if (!testInfo) {
    exit(-1)
  }

  if (justShowTree) {
    printTestTree(testInfo)
    node.close()
    await closeDevice(canBaseMap, linBaseMap, ethBaseMap, pwmBaseMap)
    return
  }
  node.close()

  const node1 = new NodeClass(
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

  // Generate EnableObj based on pattern
  const EnableObj: Record<number, boolean> = {}
  if (testInfo && testInfo.length > 0) {
    let testCnt = 0
    const processTestEvents = (events: TestEvent[]) => {
      for (const event of events) {
        if (event.type === 'test:dequeue') {
          testCnt++
          const testName = event.data.name

          // If pattern is provided, check if test name matches the pattern
          if (pattern) {
            try {
              const regex = new RegExp(pattern)
              if (regex.test(testName)) {
                EnableObj[testCnt] = true
              }
            } catch (e) {
              // If pattern is not a valid regex, treat it as a simple string match
              if (testName.includes(pattern)) {
                EnableObj[testCnt] = true
              }
            }
          } else {
            // If no pattern, enable all tests
            EnableObj[testCnt] = true
          }
        }
      }
    }

    processTestEvents(testInfo)
  }
  await node1.start(EnableObj)
  const finalTestInfo = await node1.getTestInfo()

  // 统计测试结果
  const testSummary = analyzeTestResults(finalTestInfo)
  printTestSummary(testSummary)

  if (reportPath) {
    const html = await node1.generateHtml(reportPath, true)
    reportPath = path.join(process.cwd(), reportPath)
    await fsP.writeFile(reportPath, html)
    sysLog.info(`test report saved to ${reportPath}`)
  }
  node1.close()

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

  sysLog.info(`${indent}${prefix}${node.label}`)

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
    sysLog.info('No tests found.')
    return
  }

  const roots = buildSubTree(filteredTestInfo)

  sysLog.info('\nTest Structure:')
  sysLog.info('==============')

  if (roots.length === 0) {
    sysLog.info('No test structure found.')
    return
  }

  roots.forEach((root, index) => {
    const isLast = index === roots.length - 1
    printTreeNode(root, '', isLast)
  })

  sysLog.info('') // Add empty line at the end
}

// 测试结果统计接口
interface TestSummary {
  total: number
  passed: number
  failed: number
  skipped: number
  failedTests: string[]
}

// 分析测试结果并生成统计信息
function analyzeTestResults(testInfo: (TestEvent | string)[] | undefined): TestSummary {
  const summary: TestSummary = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    failedTests: []
  }

  if (!testInfo || testInfo.length === 0) {
    return summary
  }

  // 过滤掉内部测试标记
  const filteredTestInfo = testInfo.filter(
    (item: any) =>
      typeof item === 'object' && item.data && item.data.name !== '____ecubus_pro_test___'
  ) as TestEvent[]

  for (const event of filteredTestInfo) {
    switch (event.type) {
      case 'test:dequeue':
        summary.total++
        break
      case 'test:pass':
        summary.passed++
        break
      case 'test:fail':
        summary.failed++
        if (event.data && event.data.name) {
          summary.failedTests.push(event.data.name)
        }
        break
      case 'test:start':
        break
      case 'test:complete':
        break
    }
  }

  return summary
}

// 打印测试结果总结
function printTestSummary(summary: TestSummary): void {
  const successRate = summary.total > 0 ? ((summary.passed / summary.total) * 100).toFixed(1) : 0
  const result = summary.failed > 0 ? 'FAILED' : 'PASSED'

  sysLog.info(
    `Test Summary:\n` +
      `  Total: ${summary.total}\n` +
      `  Passed: ${summary.passed} ✅\n` +
      `  Failed: ${summary.failed} ❌\n` +
      `  Skipped: ${summary.skipped} ⏭️\n` +
      `  Success Rate: ${successRate}%`
  )
  if (result == 'FAILED') {
    sysLog.error(`Result: ${result}`)
  } else {
    sysLog.info(`Result: ${result}`)
  }

  if (summary.failed > 0 && summary.failedTests.length > 0) {
    sysLog.error(`Failed Tests: ${summary.failedTests.join(', ')}`)
  }
}
