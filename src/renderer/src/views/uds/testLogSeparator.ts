/**
 * Visual grouping for the Test module terminal.
 *
 * Node's test:dequeue `type` field is not reliable here: queued siblings are
 * reported with their parent's type (see processPendingSubtests in the Node 24
 * test runner). Nesting is stable:
 * - 0: a top-level suite or test
 * - 1: a case inside a suite, or a subtest of a top-level test
 * - 2+: a subtest of a case
 *
 * Cases (nesting <= 1) are separated with a blank line. Subtests (nesting >= 2)
 * stay in the parent case and are inset.
 */

export interface TestLogFrame {
  name: string
  nesting: number
}

export interface TestLogSeparatorState {
  open: TestLogFrame[]
  hasOutput: boolean
  /** The previous visible line was a top-level banner, so its first case stays attached. */
  attachChild: boolean
}

export interface TestLogNode {
  name: string
  nesting?: number
}

export function createTestLogSeparatorState(): TestLogSeparatorState {
  return {
    open: [],
    hasOutput: false,
    attachChild: false
  }
}

export function resetTestLogSeparator(state: TestLogSeparatorState) {
  state.open.length = 0
  state.hasOutput = false
  state.attachChild = false
}

export function isNestedSubtest(nesting: number) {
  return nesting >= 2
}

/**
 * Record that a test or suite has started. Returns whether a blank line should
 * precede its "starting" line. Hidden entries must still be recorded so later
 * siblings keep the right parent.
 */
export function beginTestLogEntry(state: TestLogSeparatorState, node: TestLogNode) {
  const nesting = node.nesting ?? 0
  let separate = !isNestedSubtest(nesting) && state.hasOutput
  if (separate && nesting === 1 && state.attachChild) {
    separate = false
  }
  state.open.push({ name: node.name, nesting })
  return { separate }
}

/** A visible log line was written. Group banners keep the following case attached. */
export function noteTestLogWritten(state: TestLogSeparatorState, kind: 'group' | 'text') {
  state.hasOutput = true
  state.attachChild = kind === 'group'
}

/** Record that a test or suite finished, after its pass/fail line is written. */
export function endTestLogEntry(state: TestLogSeparatorState, node: TestLogNode) {
  const nesting = node.nesting ?? 0
  for (let i = state.open.length - 1; i >= 0; i--) {
    const frame = state.open[i]
    if (frame.nesting === nesting && frame.name === node.name) {
      state.open.length = i
      return
    }
  }
}

/** Extra spaces in front of the message while a nested subtest is open. */
export function testLogMessageIndent(state: TestLogSeparatorState) {
  const nesting = state.open.length ? state.open[state.open.length - 1].nesting : 0
  if (nesting < 2) return 0
  return (nesting - 1) * 2
}
