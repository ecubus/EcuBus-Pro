/**
 * Grouping for the Test module terminal.
 *
 * Node's test:dequeue `type` field is not reliable here: queued siblings are
 * reported with their parent's type. Nesting is stable:
 * - 0: a top-level suite, or a test that is not inside a suite
 * - 1: a case inside a suite
 * - 2+: a subtest of a case
 *
 * A case (nesting 1, or a nesting-0 test that never gains a child) is one
 * block. Nested subtests stay inside that block. A suite is not its own block
 * once it has children; hovering it still covers the lines from its start
 * through its result.
 */

export interface TestLogFrame {
  id: string
  name: string
  nesting: number
  /** This frame owns a resting background band. */
  band: boolean
  hadChild: boolean
}

export interface TestLogSeparatorState {
  open: TestLogFrame[]
  seq: number
}

export interface TestLogNode {
  name: string
  nesting?: number
  line?: number
  column?: number
}

export function createTestLogSeparatorState(): TestLogSeparatorState {
  return { open: [], seq: 0 }
}

export function resetTestLogSeparator(state: TestLogSeparatorState) {
  state.open.length = 0
  state.seq = 0
}

/**
 * Shared with the test tree. Sequence, not source line, distinguishes two
 * cases that share a name: discovery and the run can report different lines.
 */
export function formatTestLogId(node: TestLogNode, seq: number) {
  return `${node.name}:${seq}`
}

/**
 * Columns per tree level. The test tree steps each child by 18px, which is
 * two columns of the 14px log font. Nesting 0 is the left edge.
 */
export const testLogIndentStep = 2

export function testLogMessageIndent(nesting: number) {
  if (nesting <= 0) return 0
  return nesting * testLogIndentStep
}

export function currentTestLogIndent(state: TestLogSeparatorState) {
  const top = state.open[state.open.length - 1]
  if (!top) return 0
  return testLogMessageIndent(top.nesting)
}

export interface BeginTestLogResult {
  id: string
  nesting: number
  indent: number
}

/** Record that a test or suite has started. Hidden entries must still be recorded. */
export function beginTestLogEntry(
  state: TestLogSeparatorState,
  node: TestLogNode
): BeginTestLogResult {
  const nesting = node.nesting ?? 0
  const parent = state.open[state.open.length - 1]
  if (parent) parent.hadChild = true
  const id = formatTestLogId(node, state.seq++)
  state.open.push({
    id,
    name: node.name,
    nesting,
    band: nesting === 1,
    hadChild: false
  })
  return { id, nesting, indent: testLogMessageIndent(nesting) }
}

export function findOpenTestLogId(state: TestLogSeparatorState, node: TestLogNode) {
  const nesting = node.nesting ?? 0
  for (let i = state.open.length - 1; i >= 0; i--) {
    const frame = state.open[i]
    if (frame.nesting === nesting && frame.name === node.name) return frame.id
  }
  return undefined
}

/** Frames that should include the line about to be written, outermost last. */
export function openTestLogFrames(state: TestLogSeparatorState) {
  return state.open
}

export interface EndTestLogResult {
  id: string
  /** A top-level test with no children becomes its own band when it finishes. */
  promoteBand: boolean
}

/** Record that a test or suite finished, after its pass/fail line is written. */
export function endTestLogEntry(
  state: TestLogSeparatorState,
  node: TestLogNode
): EndTestLogResult | undefined {
  const nesting = node.nesting ?? 0
  for (let i = state.open.length - 1; i >= 0; i--) {
    const frame = state.open[i]
    if (frame.nesting === nesting && frame.name === node.name) {
      const promoteBand = frame.nesting === 0 && !frame.hadChild
      if (promoteBand) frame.band = true
      state.open.length = i
      return { id: frame.id, promoteBand }
    }
  }
  return undefined
}
