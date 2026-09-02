import { describe, expect, it } from 'vitest'
import { LDF, NodeAttrDef } from '../../src/renderer/src/database/ldfParse'
import {
  getNodeProtocolSyncDecision,
  getNodesNeedingProtocolSync,
  hasCustomNodeProtocols,
  syncAllNodeProtocols
} from '../../src/renderer/src/database/ldf/syncNodeProtocol'

function makeLdf(protocols: Record<string, string>): LDF {
  const nodeAttrs: Record<string, NodeAttrDef> = {}
  for (const [name, LIN_protocol] of Object.entries(protocols)) {
    nodeAttrs[name] = { LIN_protocol } as NodeAttrDef
  }
  return { nodeAttrs } as LDF
}

describe('syncNodeProtocol', () => {
  it('lists nodes whose Protocol differs from the target version', () => {
    const ldf = makeLdf({ Motor1: '2.1', Motor2: '2.2', Motor3: '' })
    expect(getNodesNeedingProtocolSync(ldf, '2.2').sort()).toEqual(['Motor1', 'Motor3'])
    expect(getNodesNeedingProtocolSync(ldf, '2.1')).toEqual(['Motor2', 'Motor3'])
  })

  it('treats empty nodeAttrs as nothing to sync', () => {
    expect(getNodesNeedingProtocolSync({ nodeAttrs: {} } as LDF, '2.2')).toEqual([])
    expect(getNodeProtocolSyncDecision({ nodeAttrs: {} } as LDF, '2.2', '2.1')).toBe('none')
  })

  it('detects nodes customized away from the previous global version', () => {
    expect(hasCustomNodeProtocols(makeLdf({ Motor1: '2.1', Motor2: '2.1' }), '2.1')).toBe(false)
    expect(hasCustomNodeProtocols(makeLdf({ Motor1: '2.1', Motor2: '' }), '2.1')).toBe(false)
    expect(hasCustomNodeProtocols(makeLdf({ Motor1: '2.1', Motor2: '2.2' }), '2.1')).toBe(true)
  })

  it('auto-syncs when every node still follows the previous global version', () => {
    const ldf = makeLdf({ Motor1: '2.1', Motor2: '2.1' })
    expect(getNodeProtocolSyncDecision(ldf, '2.2', '2.1')).toBe('auto')
  })

  it('auto-syncs empty Protocol values together with matching nodes', () => {
    const ldf = makeLdf({ Motor1: '2.1', Motor2: '' })
    expect(getNodeProtocolSyncDecision(ldf, '2.2', '2.1')).toBe('auto')
  })

  it('asks for confirmation when a node Protocol was customized', () => {
    const ldf = makeLdf({ Motor1: '2.1', Motor2: '2.0' })
    expect(getNodeProtocolSyncDecision(ldf, '2.2', '2.1')).toBe('confirm')
  })

  it('does nothing when every node already matches the new version', () => {
    const ldf = makeLdf({ Motor1: '2.2', Motor2: '2.2' })
    expect(getNodeProtocolSyncDecision(ldf, '2.2', '2.1')).toBe('none')
  })

  it('does nothing when the new version is empty', () => {
    const ldf = makeLdf({ Motor1: '2.1' })
    expect(getNodeProtocolSyncDecision(ldf, '', '2.1')).toBe('none')
  })

  it('writes the new version onto every node Protocol', () => {
    const ldf = makeLdf({ Motor1: '2.1', Motor2: '2.0', Motor3: '' })
    syncAllNodeProtocols(ldf, '2.2')
    expect(ldf.nodeAttrs.Motor1.LIN_protocol).toBe('2.2')
    expect(ldf.nodeAttrs.Motor2.LIN_protocol).toBe('2.2')
    expect(ldf.nodeAttrs.Motor3.LIN_protocol).toBe('2.2')
  })
})
