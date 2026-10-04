/**
 * Match discovered test-tree nodes to node:test events.
 *
 * User scripts call the `test()` wrapper in `src/main/worker/uds.ts`, so every
 * case reports that wrapper's file/line/column. Keying nodes by
 * `name:line:column` collapses same-named cases onto one Element Plus node.
 * Discovery and runtime therefore share one walk (`createTestEventWalker`):
 * the Nth node opened is the Nth tree node.
 */

export const TEST_SENTINEL_NAME = '____ecubus_pro_test___'

export type DiscoveredTestNode = {
  id: string
  label: string
  nesting?: number
  eventKey: string
  children: DiscoveredTestNode[]
}

export type MatchableTestNode = {
  id: string
  label: string
  children?: MatchableTestNode[]
  status?: 'pass' | 'fail' | 'skip' | 'running'
  time?: string
}

type TestLocation = {
  name?: string
  nesting?: number
  line?: number
  column?: number
  skip?: unknown
  details?: {
    duration_ms?: number
  }
}

export type TestEventInput = {
  type: string
  data?: unknown
}

type WalkerFrame = {
  label: string | undefined
  nesting: number | undefined
}

function readLocation(event: TestEventInput): TestLocation | undefined {
  if (!event.data || typeof event.data !== 'object') return undefined
  return event.data as TestLocation
}

export function testEventKey(event: { name?: string; line?: number; column?: number }): string {
  return `${event.name}:${event.line || 0}:${event.column || 0}`
}

/**
 * Replay the open/close decisions of the test tree.
 * `____ecubus_pro_test___` is ignored, matching discovery.
 * `test:start` and every other event type are ignored.
 */
function createTestEventWalker(handlers: {
  open: (event: TestLocation, reason: 'dequeue' | 'repair') => void
  close: (event: TestLocation, type: 'test:pass' | 'test:fail', pop: boolean) => void
}): { push: (event: TestEventInput) => void } {
  let current: WalkerFrame | undefined
  const stack: WalkerFrame[] = []

  const open = (event: TestLocation, reason: 'dequeue' | 'repair') => {
    const frame: WalkerFrame = { label: event.name, nesting: event.nesting }
    stack.push(frame)
    current = frame
    handlers.open(event, reason)
  }

  return {
    push(raw: TestEventInput) {
      const data = readLocation(raw)
      if (data?.name === TEST_SENTINEL_NAME) return
      if (raw.type === 'test:dequeue') {
        open(data ?? {}, 'dequeue')
        return
      }
      if (raw.type !== 'test:pass' && raw.type !== 'test:fail') return

      const loc = data ?? {}
      if (!current) open({ name: 'root', nesting: 0, line: 0, column: 0 }, 'repair')
      if (!current || current.label !== loc.name || current.nesting !== loc.nesting) {
        open(loc, 'repair')
      }
      const pop = !!current && current.nesting === loc.nesting
      handlers.close(loc, raw.type === 'test:fail' ? 'test:fail' : 'test:pass', pop)
      if (pop) {
        stack.pop()
        current = stack[stack.length - 1]
      }
    }
  }
}

export function buildTestSubTree(
  infos: ReadonlyArray<TestEventInput>,
  idPrefix: string
): DiscoveredTestNode[] {
  const roots: DiscoveredTestNode[] = []
  const stack: DiscoveredTestNode[] = []
  let seq = 0
  const walker = createTestEventWalker({
    open(event) {
      const node: DiscoveredTestNode = {
        id: `${idPrefix}:${seq++}`,
        label: event.name ?? '',
        nesting: event.nesting,
        eventKey: testEventKey(event),
        children: []
      }
      const parent = stack[stack.length - 1]
      if (parent) parent.children.push(node)
      else roots.push(node)
      stack.push(node)
    },
    close(_event, _type, pop) {
      if (pop) stack.pop()
    }
  })
  for (const event of infos) walker.push(event)
  return roots
}

/**
 * Copy discovered nodes into the UI tree and number leaves the same way as #391.
 * Only leaves receive `testCnt`, in preorder.
 */
export function appendDiscoveredTest<T extends { children: T[]; testCnt?: number }>(
  cnt: number,
  parent: { children: T[] },
  root: DiscoveredTestNode,
  create: (root: DiscoveredTestNode) => T
): number {
  const node = create(root)
  parent.children.push(node)
  if (root.children.length > 0) {
    for (const child of root.children) {
      cnt = appendDiscoveredTest(cnt, node, child, create)
    }
  } else {
    node.testCnt = cnt
    cnt++
  }
  return cnt
}

function flattenTestNodes(nodes: readonly MatchableTestNode[]): MatchableTestNode[] {
  const flat: MatchableTestNode[] = []
  const visit = (node: MatchableTestNode) => {
    flat.push(node)
    for (const child of node.children ?? []) visit(child)
  }
  for (const node of nodes) visit(node)
  return flat
}

function formatDuration(durationMs: number | undefined): string | undefined {
  if (typeof durationMs !== 'number') return undefined
  return Number(durationMs / 1000).toFixed(3)
}

/**
 * Apply runtime `test:dequeue` / `test:pass` / `test:fail` events to an already
 * built tree. `selectedIds` limits painting to those node ids (single-test run).
 * Unselected nodes stay untouched, including skipped ones, but still consume a
 * slot so later cases stay aligned.
 */
export class TestTreeMatcher {
  private readonly nodes: MatchableTestNode[]
  private readonly selected?: ReadonlySet<string>
  private index = 0
  private readonly stack: Array<MatchableTestNode | undefined> = []
  private readonly walker: { push: (event: TestEventInput) => void }

  constructor(roots: readonly MatchableTestNode[], selectedIds?: readonly string[]) {
    this.nodes = flattenTestNodes(roots)
    if (selectedIds) this.selected = new Set(selectedIds)
    this.walker = createTestEventWalker({
      open: (_event, reason) => {
        const node = this.nodes[this.index++]
        this.stack.push(node)
        if (reason === 'dequeue' && node) this.paint(node, 'running')
      },
      close: (event, type, pop) => {
        const node = this.stack[this.stack.length - 1]
        if (node) {
          let status: 'pass' | 'fail' | 'skip' = type === 'test:fail' ? 'fail' : 'pass'
          if (type === 'test:pass' && event.skip) status = 'skip'
          this.paint(node, status, formatDuration(event.details?.duration_ms))
        }
        if (pop) this.stack.pop()
      }
    })
  }

  apply(event: TestEventInput) {
    this.walker.push(event)
  }

  private paint(
    node: MatchableTestNode,
    status: NonNullable<MatchableTestNode['status']>,
    time?: string
  ) {
    if (this.selected && !this.selected.has(node.id)) return
    node.status = status
    if (time !== undefined) node.time = time
  }
}
