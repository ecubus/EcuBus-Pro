import { describe, expect, it } from 'vitest'
import {
  beginTestLogEntry,
  createTestLogSeparatorState,
  endTestLogEntry,
  noteTestLogWritten,
  resetTestLogSeparator,
  testLogMessageIndent
} from '@r/views/uds/testLogSeparator'

function start(
  state: ReturnType<typeof createTestLogSeparatorState>,
  name: string,
  nesting: number
) {
  const { separate } = beginTestLogEntry(state, { name, nesting })
  const indent = testLogMessageIndent(state)
  noteTestLogWritten(state, nesting === 0 ? 'group' : 'text')
  return { separate, indent }
}

function finish(
  state: ReturnType<typeof createTestLogSeparatorState>,
  name: string,
  nesting: number
) {
  const indent = testLogMessageIndent(state)
  endTestLogEntry(state, { name, nesting })
  noteTestLogWritten(state, 'text')
  return { indent }
}

describe('test log case separation', () => {
  it('separates sibling cases and keeps nested subtests inside the parent', () => {
    const state = createTestLogSeparatorState()
    noteTestLogWritten(state, 'text')

    expect(start(state, 'CAN Test', 0)).toEqual({ separate: true, indent: 0 })
    expect(start(state, 'pass case', 1)).toEqual({ separate: false, indent: 0 })
    expect(finish(state, 'pass case', 1).indent).toBe(0)

    expect(start(state, 'fail case', 1)).toEqual({ separate: true, indent: 0 })
    expect(finish(state, 'fail case', 1).indent).toBe(0)

    expect(start(state, 'skip case', 1)).toEqual({ separate: true, indent: 0 })
    expect(finish(state, 'skip case', 1).indent).toBe(0)

    expect(start(state, 'parent with subtests', 1)).toEqual({ separate: true, indent: 0 })
    expect(start(state, 'nested one', 2)).toEqual({ separate: false, indent: 2 })
    expect(testLogMessageIndent(state)).toBe(2)
    expect(finish(state, 'nested one', 2).indent).toBe(2)
    expect(testLogMessageIndent(state)).toBe(0)

    expect(start(state, 'nested two', 2)).toEqual({ separate: false, indent: 2 })
    expect(finish(state, 'nested two', 2).indent).toBe(2)
    expect(finish(state, 'parent with subtests', 1).indent).toBe(0)

    expect(finish(state, 'CAN Test', 0).indent).toBe(0)
    expect(start(state, 'UDS Test', 0)).toEqual({ separate: true, indent: 0 })
    expect(start(state, 'diag', 1)).toEqual({ separate: false, indent: 0 })
  })

  it('does not insert a leading gap before the first line', () => {
    const state = createTestLogSeparatorState()
    expect(start(state, 'CAN Test', 0)).toEqual({ separate: false, indent: 0 })
  })

  it('indents deeper subtests further and leaves the parent case flush', () => {
    const state = createTestLogSeparatorState()
    start(state, 'suite', 0)
    start(state, 'parent', 1)
    expect(start(state, 'child', 2).indent).toBe(2)
    expect(start(state, 'grandchild', 3)).toEqual({ separate: false, indent: 4 })
    expect(finish(state, 'grandchild', 3).indent).toBe(4)
    expect(finish(state, 'child', 2).indent).toBe(2)
    expect(testLogMessageIndent(state)).toBe(0)
  })

  it('keeps a file root open when a same-nesting suite finishes', () => {
    const state = createTestLogSeparatorState()
    noteTestLogWritten(state, 'text')
    start(state, '/tmp/suite.js', 0)
    start(state, 'CAN Test', 0)
    start(state, 'pass case', 1)
    finish(state, 'pass case', 1)
    finish(state, 'CAN Test', 0)
    expect(state.open.map((frame) => frame.name)).toEqual(['/tmp/suite.js'])
    expect(start(state, 'UDS Test', 0).separate).toBe(true)
  })

  it('resets grouping after the log is cleared', () => {
    const state = createTestLogSeparatorState()
    noteTestLogWritten(state, 'text')
    start(state, 'CAN Test', 0)
    resetTestLogSeparator(state)
    expect(start(state, 'CAN Test', 0)).toEqual({ separate: false, indent: 0 })
    expect(state.open).toEqual([{ name: 'CAN Test', nesting: 0 }])
  })
})
