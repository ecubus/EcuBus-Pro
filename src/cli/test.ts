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
import { format } from 'winston'

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
    await build(projectPath, projectName, data, testItem.script, { isTest: true })
  }
  const { canBaseMap, linBaseMap, ethBaseMap, pwmBaseMap, someipMap } = await deviceMain(
    projectPath,
    projectName,
    data.devices
  )

  const doips: DOIP[] = []
  for (const tester of Object.values(data.tester)) {
    if (tester.type == 'eth') {
      for (const val of ethBaseMap.values()) {
        const doip = new DOIP(val, tester, __dirname)
        doips.push(doip)
      }
    }
  }

  const node = new NodeClass(
    testItem,

    projectPath,
    projectName,

    {
      testOnly: true,
      id: testItem.id
    }
  )
  node.init(testItem, canBaseMap, linBaseMap, doips, ethBaseMap, pwmBaseMap, someipMap, data.tester)
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
    await closeDevice(canBaseMap, linBaseMap, ethBaseMap, pwmBaseMap, someipMap)
    return
  }
  node.close()

  const node1 = new NodeClass(testItem, projectPath, projectName, {
    id: testItem.id
  })
  node1.init(
    testItem,
    canBaseMap,
    linBaseMap,
    doips,
    ethBaseMap,
    pwmBaseMap,
    someipMap,
    data.tester
  )
  // Generate EnableObj and isSingleRun based on pattern (matching test.vue logic)
  const EnableObj: Record<number, boolean> = {}
  let isSingleRun: string[] | undefined = undefined

  //filter
  const filter = format((info: any, opts: any) => {
    // Skip internal test markers
    if ((info.message.data?.data as any)?.name === '____ecubus_pro_test___') {
      return false
    }

    // Handle different test event types like testLog function
    if (
      info.message.data.type === 'test:dequeue' ||
      info.message.data.type === 'test:pass' ||
      info.message.data.type === 'test:fail'
    ) {
      if (isSingleRun) {
        const key =
          info.message.data.data.name +
          ':' +
          info.message.data.data.line +
          ':' +
          info.message.data.data.column

        if (isSingleRun.includes(key)) {
          return info
        }
        return false
      }
    }

    return info
  })

  node1.log!.log.format = format.combine(filter(), node1.log!.log.format)
  if (testInfo && testInfo.length > 0) {
    // Build test tree structure similar to test.vue
    const filteredTestInfo = testInfo.filter(
      (item: any) =>
        typeof item === 'object' && item.data && item.data.name !== '____ecubus_pro_test___'
    ) as TestEvent[]

    const roots = buildSubTree(filteredTestInfo)

    // Create tree structure with testCnt like in test.vue
    interface TestTreeWithCnt extends TestTreeNode {
      testCnt?: number
    }

    const root2tree = (cnt: number, parent: TestTreeWithCnt, root: TestTreeNode): number => {
      const newNode: TestTreeWithCnt = {
        testCnt: cnt,
        id: root.id,
        type: 'test',
        label: root.label,
        children: []
      }
      cnt++
      parent.children.push(newNode)

      if (root.children && root.children.length > 0) {
        for (const child of root.children) {
          cnt = root2tree(cnt, newNode, child)
        }
      }
      return cnt
    }

    // Build tree with test counts
    const configNode: TestTreeWithCnt = {
      id: testItem.id,
      type: 'config',
      label: testItem.name,
      children: []
    }

    let cnt = 0
    for (const root of roots) {
      cnt = root2tree(cnt, configNode, root)
    }

    // Build parent references for tree navigation
    const buildParentReferences = (node: TestTreeWithCnt, parent?: TestTreeWithCnt) => {
      if (parent) {
        ;(node as any).parent = parent
      }
      if (node.children) {
        for (const child of node.children) {
          buildParentReferences(child as TestTreeWithCnt, node)
        }
      }
    }

    // Build parent references for the entire tree
    buildParentReferences(configNode)

    // Implement getChildren function from test.vue
    const getChildren = (val: TestTreeWithCnt, ids?: string[]) => {
      const cntArray: number[] = []
      for (const item of val.children) {
        const childWithCnt = item as TestTreeWithCnt
        if (childWithCnt.testCnt !== undefined) {
          cntArray.push(childWithCnt.testCnt)
          if (ids) {
            ids.push(childWithCnt.id)
          }
        }
        if (childWithCnt.children) {
          const childCnts = getChildren(childWithCnt, ids)
          cntArray.push(...childCnts)
        }
      }
      return cntArray
    }

    // Find a node by id in the tree
    const findNodeById = (tree: TestTreeWithCnt, id: string): TestTreeWithCnt | null => {
      if (tree.id === id) {
        return tree
      }
      if (tree.children) {
        for (const child of tree.children) {
          const found = findNodeById(child as TestTreeWithCnt, id)
          if (found) {
            return found
          }
        }
      }
      return null
    }

    // Implement getParent function similar to Vue component
    const getParent = (node: TestTreeWithCnt, cntArray: number[]) => {
      const parent = (node as any).parent as TestTreeWithCnt
      if (parent && parent.type === 'test') {
        if (parent.testCnt !== undefined) {
          cntArray.push(parent.testCnt)
        }
        getParent(parent, cntArray)
      }
    }

    // Logic similar to handleRun in test.vue
    if (pattern) {
      // Single run mode - find specific test by pattern
      isSingleRun = []
      const collectTestCnts: number[] = []

      // Find test nodes that match the pattern (simplified - just collect IDs)
      const findMatchingTests = (node: TestTreeWithCnt) => {
        if (node.type === 'test') {
          try {
            const regex = new RegExp(pattern)
            if (regex.test(node.label)) {
              isSingleRun!.push(node.id)
            }
          } catch (e) {
            // If pattern is not a valid regex, treat it as a simple string match
            if (node.label.includes(pattern)) {
              isSingleRun!.push(node.id)
            }
          }
        }
        if (node.children) {
          for (const child of node.children) {
            findMatchingTests(child as TestTreeWithCnt)
          }
        }
      }

      findMatchingTests(configNode)

      // For each found test, also add its parents to EnableObj (like Vue component)
      for (const testId of isSingleRun) {
        const node = findNodeById(configNode, testId)
        if (node) {
          // Add the test itself if it has a testCnt
          if (node.testCnt !== undefined) {
            collectTestCnts.push(node.testCnt)
          }
          // Add all children
          const childCnts = getChildren(node)
          collectTestCnts.push(...childCnts)

          // Add all parents (this was missing!)
          const parentCnts: number[] = []
          getParent(node, parentCnts)
          collectTestCnts.push(...parentCnts)
        }
      }

      // Remove duplicates and generate EnableObj from collected test counts
      const uniqueTestCnts = [...new Set(collectTestCnts)]
      for (const testCnt of uniqueTestCnts) {
        EnableObj[testCnt] = true
      }
    } else {
      // Run all tests (config mode)
      isSingleRun = undefined
      const allCnts = getChildren(configNode)

      for (const testCnt of allCnts) {
        EnableObj[testCnt] = true
      }
    }
  }

  await node1.start(EnableObj)
  const finalTestInfo = await node1.getTestInfo()

  // 统计测试结果
  const testSummary = analyzeTestResults(finalTestInfo, isSingleRun)
  printTestSummary(testSummary)

  if (reportPath) {
    const html = await node1.generateHtml(reportPath, true)
    reportPath = path.join(process.cwd(), reportPath)
    await fsP.writeFile(reportPath, html)
    sysLog.info(`test report saved to ${reportPath}`)
  }
  node1.close()

  await closeDevice(canBaseMap, linBaseMap, ethBaseMap, pwmBaseMap, someipMap)

  if (testSummary.failed > 0) {
    exit(-1)
  }
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
function analyzeTestResults(
  testInfo: (TestEvent | string)[] | undefined,
  isSingleRun?: string[]
): TestSummary {
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
  let filteredTestInfo = testInfo.filter(
    (item: any) =>
      typeof item === 'object' && item.data && item.data.name !== '____ecubus_pro_test___'
  ) as TestEvent[]

  // 如果是单个测试运行模式，进一步过滤只包含在isSingleRun中的测试
  if (isSingleRun && isSingleRun.length > 0) {
    filteredTestInfo = filteredTestInfo.filter((event: TestEvent) => {
      if (
        event.data &&
        (event.type === 'test:dequeue' || event.type === 'test:pass' || event.type === 'test:fail')
      ) {
        // 构建测试ID (和buildSubTree中的逻辑保持一致)
        const eventData = event.data as any
        const testId = `${eventData.name}:${eventData.line || 0}:${eventData.column || 0}`
        return isSingleRun.includes(testId)
      }
      return false
    })
  }

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
