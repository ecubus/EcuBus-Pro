import { describe, expect, it } from 'vitest'
import {
  appendDiscoveredTest,
  buildTestSubTree,
  TEST_SENTINEL_NAME,
  TestTreeMatcher,
  type DiscoveredTestNode,
  type TestEventInput
} from '../../src/renderer/src/views/uds/testTreeMatch'

const DUP = 'DiagnosticSessionControl160 test'
const CALLSITE = { line: 12, column: 4 }

type Mounted = {
  id: string
  label: string
  eventKey: string
  children: Mounted[]
  testCnt?: number
  status?: 'pass' | 'fail' | 'skip' | 'running'
  time?: string
}

function dequeue(
  name: string,
  nesting: number,
  line = CALLSITE.line,
  column = CALLSITE.column
): TestEventInput {
  return { type: 'test:dequeue', data: { name, nesting, line, column } }
}

function start(
  name: string,
  nesting: number,
  line = CALLSITE.line,
  column = CALLSITE.column
): TestEventInput {
  return { type: 'test:start', data: { name, nesting, line, column } }
}

function finish(
  type: 'test:pass' | 'test:fail',
  name: string,
  nesting: number,
  durationMs?: number,
  options?: { skip?: boolean; line?: number; column?: number }
): TestEventInput {
  return {
    type,
    data: {
      name,
      nesting,
      line: options?.line ?? CALLSITE.line,
      column: options?.column ?? CALLSITE.column,
      skip: options?.skip,
      details: durationMs == null ? undefined : { duration_ms: durationMs }
    }
  }
}

function pass(
  name: string,
  nesting: number,
  durationMs?: number,
  options?: { skip?: boolean; line?: number; column?: number }
) {
  return finish('test:pass', name, nesting, durationMs, options)
}

function fail(name: string, nesting: number, durationMs?: number) {
  return finish('test:fail', name, nesting, durationMs)
}

function mount(events: TestEventInput[], idPrefix = 'cfg'): Mounted[] {
  const discovered: DiscoveredTestNode[] = buildTestSubTree(events, idPrefix)
  const parent = { children: [] as Mounted[] }
  let cnt = 0
  for (const root of discovered) {
    cnt = appendDiscoveredTest(cnt, parent, root, (source) => ({
      id: source.id,
      label: source.label,
      eventKey: source.eventKey,
      children: []
    }))
  }
  return parent.children
}

function apply(nodes: Mounted[], events: TestEventInput[], selectedIds?: readonly string[]) {
  const matcher = new TestTreeMatcher(nodes, selectedIds)
  for (const event of events) matcher.apply(event)
}

function labeled(nodes: Mounted[], label: string): Mounted[] {
  const found: Mounted[] = []
  const visit = (node: Mounted) => {
    if (node.label === label) found.push(node)
    for (const child of node.children) visit(child)
  }
  for (const node of nodes) visit(node)
  return found
}

describe('test tree occurrence matching', () => {
  it('gives each same-named case its own status and duration', () => {
    const structure: TestEventInput[] = [
      dequeue('suite', 0, 2, 1),
      dequeue(DUP, 1),
      pass(DUP, 1),
      dequeue(TEST_SENTINEL_NAME, 0, 99, 1),
      pass(TEST_SENTINEL_NAME, 0, 1, { line: 99, column: 1 }),
      dequeue(DUP, 1),
      pass(DUP, 1),
      pass('suite', 0, undefined, { line: 2, column: 1 })
    ]
    const nodes = mount(structure)
    const cases = labeled(nodes, DUP)
    const suite = labeled(nodes, 'suite')[0]

    expect(cases).toHaveLength(2)
    expect(cases[0].id).not.toBe(cases[1].id)
    expect(cases[0].eventKey).toBe(cases[1].eventKey)
    expect(cases[0].id).not.toBe(cases[0].eventKey)
    expect(labeled(nodes, TEST_SENTINEL_NAME)).toHaveLength(0)
    expect(suite.testCnt).toBeUndefined()
    expect(cases.map((node) => node.testCnt)).toEqual([0, 1])

    const runtime: TestEventInput[] = [
      dequeue('suite', 0, 2, 1),
      dequeue(DUP, 1),
      start('suite', 0, 2, 1),
      start(DUP, 1),
      pass(DUP, 1, 1500),
      dequeue(TEST_SENTINEL_NAME, 0, 99, 1),
      start(TEST_SENTINEL_NAME, 0, 99, 1),
      pass(TEST_SENTINEL_NAME, 0, 5, { line: 99, column: 1 }),
      dequeue(DUP, 1),
      start(DUP, 1),
      fail(DUP, 1, 2500),
      pass('suite', 0, 4200, { line: 2, column: 1 })
    ]
    apply(nodes, runtime)

    expect(cases[0].status).toBe('pass')
    expect(cases[0].time).toBe('1.500')
    expect(cases[1].status).toBe('fail')
    expect(cases[1].time).toBe('2.500')
    expect(suite.status).toBe('pass')
    expect(suite.time).toBe('4.200')
  })

  it('updates uniquely named tests that share the wrapper callsite', () => {
    const structure: TestEventInput[] = [
      dequeue('alpha', 0),
      pass('alpha', 0),
      dequeue('beta', 0),
      pass('beta', 0)
    ]
    const nodes = mount(structure)
    const [alpha, beta] = [labeled(nodes, 'alpha')[0], labeled(nodes, 'beta')[0]]
    expect(alpha.eventKey).toBe('alpha:12:4')
    expect(beta.eventKey).toBe('beta:12:4')
    expect(alpha.id).not.toBe(beta.id)

    apply(nodes, [
      dequeue('alpha', 0),
      start('alpha', 0),
      pass('alpha', 0, 1250),
      dequeue('beta', 0),
      start('beta', 0),
      fail('beta', 0, 2500)
    ])

    expect(alpha.status).toBe('pass')
    expect(alpha.time).toBe('1.250')
    expect(beta.status).toBe('fail')
    expect(beta.time).toBe('2.500')
  })

  it('writes a suite duration onto the suite when it shares nesting with its parent', () => {
    const structure: TestEventInput[] = [
      dequeue('file.js', 0, 1, 1),
      dequeue('suite', 0, 2, 1),
      dequeue('child', 1, 3, 3),
      pass('child', 1, undefined, { line: 3, column: 3 }),
      pass('suite', 0, undefined, { line: 2, column: 1 })
    ]
    const nodes = mount(structure)
    const file = labeled(nodes, 'file.js')[0]
    const suite = labeled(nodes, 'suite')[0]
    const child = labeled(nodes, 'child')[0]
    expect(file.children[0]).toBe(suite)
    expect(child.testCnt).toBe(0)
    expect(suite.testCnt).toBeUndefined()

    apply(nodes, [
      dequeue('file.js', 0, 1, 1),
      dequeue('suite', 0, 2, 1),
      dequeue('child', 1, 3, 3),
      start('suite', 0, 2, 1),
      start('child', 1, 3, 3),
      pass('child', 1, 1000, { line: 3, column: 3 }),
      pass('suite', 0, 4200, { line: 2, column: 1 })
    ])

    expect(child.status).toBe('pass')
    expect(child.time).toBe('1.000')
    expect(suite.status).toBe('pass')
    expect(suite.time).toBe('4.200')
    expect(file.time).toBeUndefined()
    expect(file.status).not.toBe('pass')
  })

  it('does not paint a node that was not selected for a single run', () => {
    const structure: TestEventInput[] = [
      dequeue('suite', 0, 2, 1),
      dequeue(DUP, 1),
      pass(DUP, 1),
      dequeue(DUP, 1),
      pass(DUP, 1),
      pass('suite', 0, undefined, { line: 2, column: 1 })
    ]
    const nodes = mount(structure)
    const cases = labeled(nodes, DUP)
    const suite = labeled(nodes, 'suite')[0]
    const runtime: TestEventInput[] = [
      dequeue('suite', 0, 2, 1),
      dequeue(DUP, 1),
      pass(DUP, 1, 800, { skip: true }),
      dequeue(DUP, 1),
      fail(DUP, 1, 2500),
      pass('suite', 0, 3000, { line: 2, column: 1 })
    ]

    apply(nodes, runtime, [cases[1].id])

    expect(cases[0].status).toBeUndefined()
    expect(cases[0].time).toBeUndefined()
    expect(suite.status).toBeUndefined()
    expect(suite.time).toBeUndefined()
    expect(cases[1].status).toBe('fail')
    expect(cases[1].time).toBe('2.500')

    const selectedSkip = mount(structure)
    const skipCases = labeled(selectedSkip, DUP)
    apply(selectedSkip, runtime, [skipCases[0].id])
    expect(skipCases[0].status).toBe('skip')
    expect(skipCases[0].time).toBe('0.800')
    expect(skipCases[1].status).toBeUndefined()
    expect(skipCases[1].time).toBeUndefined()
  })
})
