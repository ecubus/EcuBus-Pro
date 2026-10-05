import { describe, expect, it } from 'vitest'
import {
  beginTestLogEntry,
  createTestLogSeparatorState,
  currentTestLogIndent,
  endTestLogEntry,
  openTestLogFrames,
  resetTestLogSeparator
} from '@r/views/uds/testLogSeparator'

function start(
  state: ReturnType<typeof createTestLogSeparatorState>,
  name: string,
  nesting: number,
  line = 1
) {
  return beginTestLogEntry(state, { name, nesting, line, column: 1 })
}

function finish(
  state: ReturnType<typeof createTestLogSeparatorState>,
  name: string,
  nesting: number,
  line = 1
) {
  return endTestLogEntry(state, { name, nesting, line, column: 1 })
}

describe('test log case grouping', () => {
  it('bands sibling cases and keeps nested subtests inside the parent', () => {
    const state = createTestLogSeparatorState()

    expect(start(state, 'CAN Test', 0)).toMatchObject({ nesting: 0, indent: 0 })
    expect(openTestLogFrames(state).map((frame) => frame.band)).toEqual([false])

    expect(start(state, 'pass case', 1)).toMatchObject({ indent: 0 })
    expect(openTestLogFrames(state).map((frame) => frame.band)).toEqual([false, true])
    finish(state, 'pass case', 1)

    expect(start(state, 'fail case', 1).indent).toBe(0)
    expect(openTestLogFrames(state).at(-1)?.band).toBe(true)
    finish(state, 'fail case', 1)

    start(state, 'parent with subtests', 1)
    expect(start(state, 'nested one', 2)).toMatchObject({ indent: 2 })
    expect(currentTestLogIndent(state)).toBe(2)
    expect(openTestLogFrames(state).at(-1)?.band).toBe(false)
    expect(openTestLogFrames(state).at(-2)?.band).toBe(true)
    finish(state, 'nested one', 2)
    expect(currentTestLogIndent(state)).toBe(0)

    start(state, 'nested two', 2)
    expect(currentTestLogIndent(state)).toBe(2)
    finish(state, 'nested two', 2)
    finish(state, 'parent with subtests', 1)
    expect(finish(state, 'CAN Test', 0)).toEqual({
      id: 'CAN Test:0',
      promoteBand: false
    })
  })

  it('promotes a top-level test with no children into its own band', () => {
    const state = createTestLogSeparatorState()
    start(state, 'lone', 0, 4)
    expect(openTestLogFrames(state)[0].band).toBe(false)
    expect(finish(state, 'lone', 0, 4)).toEqual({ id: 'lone:0', promoteBand: true })
  })

  it('indents deeper subtests further', () => {
    const state = createTestLogSeparatorState()
    start(state, 'suite', 0)
    start(state, 'parent', 1)
    expect(start(state, 'child', 2).indent).toBe(2)
    expect(start(state, 'grandchild', 3).indent).toBe(4)
    finish(state, 'grandchild', 3)
    finish(state, 'child', 2)
    expect(currentTestLogIndent(state)).toBe(0)
  })

  it('keeps a file root open when a same-nesting suite finishes', () => {
    const state = createTestLogSeparatorState()
    start(state, '/tmp/suite.js', 0, 1)
    start(state, 'CAN Test', 0, 3)
    start(state, 'pass case', 1, 5)
    finish(state, 'pass case', 1, 5)
    finish(state, 'CAN Test', 0, 3)
    expect(openTestLogFrames(state).map((frame) => frame.name)).toEqual(['/tmp/suite.js'])
    expect(openTestLogFrames(state)[0].band).toBe(false)
    expect(openTestLogFrames(state)[0].hadChild).toBe(true)
  })

  it('resets grouping after the log is cleared', () => {
    const state = createTestLogSeparatorState()
    start(state, 'CAN Test', 0)
    resetTestLogSeparator(state)
    expect(start(state, 'CAN Test', 0).indent).toBe(0)
    expect(openTestLogFrames(state)).toEqual([
      {
        id: 'CAN Test:0',
        name: 'CAN Test',
        nesting: 0,
        band: false,
        hadChild: false
      }
    ])
  })
})
