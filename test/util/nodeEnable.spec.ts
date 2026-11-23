import { describe, expect, it } from 'vitest'
import { isRunnableScriptNode } from '../../src/main/share/nodeEnable'

describe('isRunnableScriptNode', () => {
  it('starts a normal script node', () => {
    expect(isRunnableScriptNode({ isTest: false, disabled: false })).toBe(true)
    expect(isRunnableScriptNode({})).toBe(true)
  })

  it('skips test configs and disabled nodes', () => {
    expect(isRunnableScriptNode({ isTest: true })).toBe(false)
    expect(isRunnableScriptNode({ disabled: true })).toBe(false)
    expect(isRunnableScriptNode({ isTest: true, disabled: true })).toBe(false)
  })
})
